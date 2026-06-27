import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import type { Queue } from 'bullmq'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type ContentAcceptanceHarness,
  createContentAcceptanceHarness,
} from './test/content-acceptance-harness'

// Group 1 introduces `ingestionQueueName('web')` in @readion/shared; it resolves to this literal.
// The acceptance harness asserts only the PRODUCER contract (job enqueued + readable state) — the
// worker processor is not booted, so the job stays `waiting`.
const INGESTION_WEB_QUEUE = 'ingestion-web'

describe('content admin acceptance', () => {
  let harness: ContentAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createContentAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('drives the admin content-source lifecycle: register, list, read, disable/enable, reingest, jobs', async () => {
    // First registration in a fresh isolated DB yields an admin.
    const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const adminAuth = `Bearer ${adminToken}`
    const certificationId = await harness.seedCertification(['Security', 'Architecture'])

    // Register a web source: default recheck interval is 10080 minutes (weekly).
    const create = await supertest(app.getHttpServer())
      .post('/api/v1/admin/content-sources')
      .set('Authorization', adminAuth)
      .send({ certificationId, type: 'web', url: 'https://example.com/material' })

    expect(create.status).toBe(201)
    expect(create.body.data).toMatchObject({
      certificationId,
      type: 'web',
      url: 'https://example.com/material',
      enabled: true,
      recheckIntervalMinutes: 10080,
    })
    expect(create.body.relationships).toBeDefined()
    const sourceId = create.body.data.id as string

    // `source.added` audit recorded.
    const afterCreateAudits = await listAudits(app, adminAuth)
    expect(afterCreateAudits.find((a) => a.action === 'source.added')?.targetId).toBe(sourceId)

    // List sources for the certification, newest-first with collection meta.
    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/content-sources')
      .query({ certificationId })
      .set('Authorization', adminAuth)

    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.meta).toBeDefined()
    expect(list.body.data.some((s: { id: string }) => s.id === sourceId)).toBe(true)

    // Read the single source.
    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}`)
      .set('Authorization', adminAuth)

    expect(read.status).toBe(200)
    expect(read.body.data).toMatchObject({ id: sourceId, enabled: true })

    // Disable flips enabled and writes `source.disabled`.
    const disable = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/disable`)
      .set('Authorization', adminAuth)

    expect(disable.status).toBe(200)
    expect(disable.body.data).toMatchObject({ id: sourceId, enabled: false })

    const afterDisable = await listAudits(app, adminAuth)
    expect(afterDisable.filter((a) => a.action === 'source.disabled')).toHaveLength(1)

    // Disabling again is an idempotent no-op: still 200, no new audit.
    const disableAgain = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/disable`)
      .set('Authorization', adminAuth)

    expect(disableAgain.status).toBe(200)
    expect(disableAgain.body.data).toMatchObject({ id: sourceId, enabled: false })

    // 409: a disabled source cannot be re-ingested (no job, no audit).
    const reingestDisabled = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/reingest`)
      .set('Authorization', adminAuth)

    expect(reingestDisabled.status).toBe(409)

    const afterBlockedReingest = await listAudits(app, adminAuth)
    expect(afterBlockedReingest.filter((a) => a.action === 'source.reingested')).toHaveLength(0)
    expect(afterBlockedReingest.filter((a) => a.action === 'source.disabled')).toHaveLength(1)

    // Re-enable writes `source.enabled`.
    const enable = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/enable`)
      .set('Authorization', adminAuth)

    expect(enable.status).toBe(200)
    expect(enable.body.data).toMatchObject({ id: sourceId, enabled: true })

    const afterEnable = await listAudits(app, adminAuth)
    expect(afterEnable.filter((a) => a.action === 'source.enabled')).toHaveLength(1)

    // Enabling again is an idempotent no-op: no new audit.
    const enableAgain = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/enable`)
      .set('Authorization', adminAuth)

    expect(enableAgain.status).toBe(200)
    expect(await listAuditCount(app, adminAuth, 'source.enabled')).toBe(1)

    // Trigger a manual re-ingest: 202 with the job descriptor.
    const reingest = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/reingest`)
      .set('Authorization', adminAuth)

    expect(reingest.status).toBe(202)
    expect(reingest.body.data).toMatchObject({ contentSourceId: sourceId })
    expect(typeof reingest.body.data.jobId).toBe('string')
    expect(typeof reingest.body.data.state).toBe('string')
    const jobId = reingest.body.data.jobId as string

    // PRODUCER contract: a job named `ingest` lands on `ingestion-web` with the expected payload.
    const queue = app.get<Queue>(`BullQueue_${INGESTION_WEB_QUEUE}`, { strict: false })
    const job = await queue.getJob(jobId)
    expect(job).toBeDefined()
    expect(job?.name).toBe('ingest')
    expect(job?.data).toMatchObject({
      contentSourceId: sourceId,
      domains: ['Security', 'Architecture'],
    })

    // `source.reingested` audit carries the jobId in `after`.
    const afterReingest = await listAudits(app, adminAuth)
    const reingestAudit = afterReingest.find((a) => a.action === 'source.reingested')
    expect(reingestAudit?.targetId).toBe(sourceId)
    expect(reingestAudit?.after).toMatchObject({ jobId })

    // List jobs for the source, most recent first.
    const jobs = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs`)
      .set('Authorization', adminAuth)

    expect(jobs.status).toBe(200)
    expect(jobs.body.meta).toBeDefined()
    expect(jobs.body.data.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true)

    // Read a single job's status.
    const jobStatus = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs/${jobId}`)
      .set('Authorization', adminAuth)

    expect(jobStatus.status).toBe(200)
    expect(jobStatus.body.data).toMatchObject({ jobId })
    expect(typeof jobStatus.body.data.state).toBe('string')
    expect('attemptsMade' in jobStatus.body.data).toBe(true)
    expect('failedReason' in jobStatus.body.data).toBe(true)

    // 404 paths for unknown source and unknown job.
    const unknownId = randomUUID()
    const missingSource = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${unknownId}`)
      .set('Authorization', adminAuth)
    expect(missingSource.status).toBe(404)

    const missingSourceDisable = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${unknownId}/disable`)
      .set('Authorization', adminAuth)
    expect(missingSourceDisable.status).toBe(404)

    const missingSourceReingest = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${unknownId}/reingest`)
      .set('Authorization', adminAuth)
    expect(missingSourceReingest.status).toBe(404)

    const missingJob = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs/${randomUUID()}`)
      .set('Authorization', adminAuth)
    expect(missingJob.status).toBe(404)
  })

  it('rejects a non-admin caller with 403 problem+json and an unauthenticated caller with 401', async () => {
    await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')

    const forbidden = await supertest(app.getHttpServer())
      .get('/api/v1/admin/content-sources')
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')

    const unauthenticated = await supertest(app.getHttpServer()).get(
      '/api/v1/admin/content-sources',
    )
    expect(unauthenticated.status).toBe(401)
  })
})

type AuditEntry = {
  action: string
  targetId: string
  after: Record<string, unknown> | null
}

async function listAudits(app: INestApplication, auth: string): Promise<AuditEntry[]> {
  const res = await supertest(app.getHttpServer())
    .get('/api/v1/admin/audit-logs')
    .query({ limit: 100 })
    .set('Authorization', auth)
  return res.body.data as AuditEntry[]
}

async function listAuditCount(
  app: INestApplication,
  auth: string,
  action: string,
): Promise<number> {
  const audits = await listAudits(app, auth)
  return audits.filter((a) => a.action === action).length
}
