import { getQueueToken } from '@nestjs/bullmq'
import { CERT_EXTRACTION_QUEUE } from '@readion/shared'
import { type Queue, Worker } from 'bullmq'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { JobEventsService, type SseStreamResponse } from './job-events.service'
import {
  type CertSetupAcceptanceHarness,
  createCertSetupAcceptanceHarness,
  EXTRACTION_FIELDS_RESULT,
  VENDOR_DOMAIN_URL,
} from './test/cert-setup-acceptance-harness'

const BASE = '/api/v1/admin/certifications'
const EXTRACTIONS = `${BASE}/extractions`
const JOB_DATA = {
  name: 'AWS Certified Cloud Practitioner',
  code: 'CLF-C02',
  confirmedSourceUrl: VENDOR_DOMAIN_URL,
}

function parseFrames(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('data:'))
    .map((block) => JSON.parse(block.slice('data:'.length).trim()))
}

// Drives an already-added job to a terminal state so the QueueEvents signal fires, without booting the
// real worker processor (per design.md Test Boundaries — the API harness never boots it).
async function drive(
  queue: Queue,
  connection: { host: string; port: number },
  result: unknown | Error,
): Promise<string> {
  const job = await queue.add('extract', JOB_DATA)
  const worker = new Worker(
    queue.name,
    async () => {
      if (result instanceof Error) throw result
      return result
    },
    { connection },
  )
  await new Promise<void>((resolve) => {
    const settle = () => resolve()
    worker.on('completed', settle)
    worker.on('failed', settle)
  })
  await worker.close()
  return String(job.id)
}

describe('cert extraction SSE events', () => {
  let harness: CertSetupAcceptanceHarness
  let queue: Queue
  let connection: { host: string; port: number }

  beforeAll(async () => {
    harness = await createCertSetupAcceptanceHarness()
    queue = harness.moduleRef.get<Queue>(getQueueToken(CERT_EXTRACTION_QUEUE))
    const opts = queue.opts.connection as { host?: string; port?: number }
    connection = { host: opts.host ?? 'localhost', port: opts.port ?? 6379 }
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  const req = () => harness.getRequest()
  const asAdmin = async () =>
    `Bearer ${await harness.registerAndLogin('admin@example.com', 'correcthorse')}`

  it('streams a completed job as an SSE frame with the grounded fields, then closes', async () => {
    const adminAuth = await asAdmin()
    const jobId = await drive(queue, connection, EXTRACTION_FIELDS_RESULT)

    const res = await req().get(`${EXTRACTIONS}/${jobId}/events`).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.headers['x-accel-buffering']).toBe('no')
    expect(res.headers['cache-control']).toContain('no-cache')

    const frames = parseFrames(res.text)
    const terminal = frames.at(-1) as {
      jobId: string
      state: string
      result: { fields: { questionCount: { value: number } } }
    }
    expect(terminal.jobId).toBe(jobId)
    expect(terminal.state).toBe('completed')
    expect(terminal.result.fields.questionCount.value).toBe(65)
  })

  it('streams a failed job as a terminal frame, then closes', async () => {
    const adminAuth = await asAdmin()
    const jobId = await drive(queue, connection, new Error('extraction blew up'))

    const res = await req().get(`${EXTRACTIONS}/${jobId}/events`).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    const frames = parseFrames(res.text)
    const terminal = frames.at(-1) as { jobId: string; state: string; result?: unknown }
    expect(terminal.state).toBe('failed')
    expect(terminal.result).toBeUndefined()
  })

  it('reports an unknown job id as a terminal failed frame and closes', async () => {
    const adminAuth = await asAdmin()

    const res = await req()
      .get(`${EXTRACTIONS}/does-not-exist/events`)
      .set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    const frames = parseFrames(res.text)
    expect(frames.at(-1)).toMatchObject({ jobId: 'does-not-exist', state: 'failed' })
  })

  it('forbids a user-role caller with 403', async () => {
    // The first registered user auto-becomes admin, so seat an admin before the plain user.
    await asAdmin()
    const userAuth = `Bearer ${await harness.registerAndLogin('member@example.com', 'correcthorse')}`
    const jobId = await drive(queue, connection, EXTRACTION_FIELDS_RESULT)

    const res = await req().get(`${EXTRACTIONS}/${jobId}/events`).set('Authorization', userAuth)

    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller with 401', async () => {
    const jobId = await drive(queue, connection, EXTRACTION_FIELDS_RESULT)

    const res = await req().get(`${EXTRACTIONS}/${jobId}/events`)

    expect(res.status).toBe(401)
  })

  // --- Retained status GET (SSE fallback) ---

  it('keeps the status GET returning state + fields', async () => {
    const adminAuth = await asAdmin()
    const jobId = await drive(queue, connection, EXTRACTION_FIELDS_RESULT)

    const res = await req().get(`${EXTRACTIONS}/${jobId}`).set('Authorization', adminAuth)

    expect(res.status).toBe(200)
    expect(res.body.data.state).toBe('completed')
    expect(res.body.data.fields.questionCount.value).toBe(65)
  })

  it('returns 404 problem+json from the status GET for an unknown job id', async () => {
    const adminAuth = await asAdmin()

    const res = await req().get(`${EXTRACTIONS}/does-not-exist`).set('Authorization', adminAuth)

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  // --- Lifecycle (service-level, short injectable timing) ---

  it('emits current state on connect and relays the terminal event while connected', async () => {
    const service = harness.moduleRef.get(JobEventsService)
    const jobId = String((await queue.add('extract', JOB_DATA)).id)

    const rec = createRecorder()
    const streaming = service.stream(queue, jobId, rec.res, {
      heartbeatMs: 10_000,
      maxDurationMs: 10_000,
    })

    // The job is non-terminal on connect; the first frame is its current (waiting/active) state.
    await vi.waitFor(() => expect(rec.frames().length).toBeGreaterThan(0))
    expect(['waiting', 'active']).toContain(rec.frames()[0]?.state)

    // Complete THIS job while the stream is open so the QueueEvents relay fires.
    const worker = new Worker(queue.name, async () => EXTRACTION_FIELDS_RESULT, { connection })
    await streaming
    await worker.close()

    const frames = rec.frames()
    expect(frames.some((f) => f.state === 'completed')).toBe(true)
    expect(rec.ended).toBe(true)
  })

  it('writes a heartbeat while the job stays non-terminal', async () => {
    const service = harness.moduleRef.get(JobEventsService)
    const jobId = String((await queue.add('extract', JOB_DATA)).id)

    const rec = createRecorder()
    const streaming = service.stream(queue, jobId, rec.res, {
      heartbeatMs: 20,
      maxDurationMs: 10_000,
    })

    await vi.waitFor(() => expect(rec.raw.some((c) => c.includes(': keepalive'))).toBe(true))
    rec.emitClose()
    await streaming
    expect(rec.ended).toBe(true)
  })

  it('closes the stream when the max duration elapses on a never-terminating job', async () => {
    const service = harness.moduleRef.get(JobEventsService)
    const jobId = String((await queue.add('extract', JOB_DATA)).id)

    const rec = createRecorder()
    await service.stream(queue, jobId, rec.res, { heartbeatMs: 10_000, maxDurationMs: 40 })

    expect(rec.ended).toBe(true)
  })

  it('closes the QueueEvents subscription when the stream ends', async () => {
    const service = harness.moduleRef.get(JobEventsService)
    const closeSpy = vi.spyOn((await import('bullmq')).QueueEvents.prototype, 'close')
    const jobId = await drive(queue, connection, EXTRACTION_FIELDS_RESULT)

    const rec = createRecorder()
    await service.stream(queue, jobId, rec.res, { heartbeatMs: 10_000, maxDurationMs: 10_000 })

    expect(closeSpy).toHaveBeenCalled()
  })
})

function createRecorder() {
  const raw: string[] = []
  let ended = false
  let closeListener: (() => void) | undefined
  const res: SseStreamResponse = {
    setHeader: () => {},
    flushHeaders: () => {},
    write: (chunk) => {
      raw.push(chunk)
    },
    end: () => {
      ended = true
    },
    on: (_event, listener) => {
      closeListener = listener
    },
  }
  return {
    res,
    raw,
    get ended() {
      return ended
    },
    frames: () =>
      raw
        .map((c) => c.trim())
        .filter((c) => c.startsWith('data:'))
        .map((c) => JSON.parse(c.slice('data:'.length).trim()) as { state: string }),
    emitClose: () => closeListener?.(),
  }
}
