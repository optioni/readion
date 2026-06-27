import { randomUUID } from 'node:crypto'
import type { Queue } from 'bullmq'
import supertest from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  bootstrapAdmin,
  CONTENT_SOURCES_PATH,
  createWebSource,
  listAuditCount,
  listAudits,
} from './test/content-requests'
import { useContentHarness } from './test/content-test-context'

// Group 1 introduces `ingestionQueueName('web')` in @readion/shared; it resolves to this literal.
// The acceptance harness asserts only the PRODUCER contract (job enqueued + readable state) — the
// worker processor is not booted, so the job stays `waiting`.
const INGESTION_WEB_QUEUE = 'ingestion-web'

describe('content admin acceptance', () => {
  const ctx = useContentHarness()

  it('drives the admin content-source lifecycle: register, list, read, disable/enable, reingest, jobs', async () => {
    // First registration in a fresh isolated DB yields an admin.
    const { auth: adminAuth, certificationId } = await bootstrapAdmin(ctx.harness, [
      'Security',
      'Architecture',
    ])

    // Register a web source: default recheck interval is 10080 minutes (weekly).
    const create = await createWebSource(ctx.app, adminAuth, certificationId)

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
    const afterCreateAudits = await listAudits(ctx.app, adminAuth)
    expect(afterCreateAudits.find((a) => a.action === 'source.added')?.targetId).toBe(sourceId)

    // List sources for the certification, newest-first with collection meta.
    const list = await supertest(ctx.app.getHttpServer())
      .get(CONTENT_SOURCES_PATH)
      .query({ certificationId })
      .set('Authorization', adminAuth)

    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.meta).toBeDefined()
    expect(list.body.data.some((s: { id: string }) => s.id === sourceId)).toBe(true)

    // Read the single source.
    const read = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}`)
      .set('Authorization', adminAuth)

    expect(read.status).toBe(200)
    expect(read.body.data).toMatchObject({ id: sourceId, enabled: true })

    // Disable flips enabled and writes `source.disabled`.
    const disable = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/disable`)
      .set('Authorization', adminAuth)

    expect(disable.status).toBe(200)
    expect(disable.body.data).toMatchObject({ id: sourceId, enabled: false })

    const afterDisable = await listAudits(ctx.app, adminAuth)
    expect(afterDisable.filter((a) => a.action === 'source.disabled')).toHaveLength(1)

    // Disabling again is an idempotent no-op: still 200, no new audit.
    const disableAgain = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/disable`)
      .set('Authorization', adminAuth)

    expect(disableAgain.status).toBe(200)
    expect(disableAgain.body.data).toMatchObject({ id: sourceId, enabled: false })

    // 409: a disabled source cannot be re-ingested (no job, no audit).
    const reingestDisabled = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/reingest`)
      .set('Authorization', adminAuth)

    expect(reingestDisabled.status).toBe(409)

    const afterBlockedReingest = await listAudits(ctx.app, adminAuth)
    expect(afterBlockedReingest.filter((a) => a.action === 'source.reingested')).toHaveLength(0)
    expect(afterBlockedReingest.filter((a) => a.action === 'source.disabled')).toHaveLength(1)

    // Re-enable writes `source.enabled`.
    const enable = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/enable`)
      .set('Authorization', adminAuth)

    expect(enable.status).toBe(200)
    expect(enable.body.data).toMatchObject({ id: sourceId, enabled: true })

    const afterEnable = await listAudits(ctx.app, adminAuth)
    expect(afterEnable.filter((a) => a.action === 'source.enabled')).toHaveLength(1)

    // Enabling again is an idempotent no-op: no new audit.
    const enableAgain = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/enable`)
      .set('Authorization', adminAuth)

    expect(enableAgain.status).toBe(200)
    expect(await listAuditCount(ctx.app, adminAuth, 'source.enabled')).toBe(1)

    // Trigger a manual re-ingest: 202 with the job descriptor.
    const reingest = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/reingest`)
      .set('Authorization', adminAuth)

    expect(reingest.status).toBe(202)
    expect(reingest.body.data).toMatchObject({ contentSourceId: sourceId })
    expect(typeof reingest.body.data.jobId).toBe('string')
    expect(typeof reingest.body.data.state).toBe('string')
    const jobId = reingest.body.data.jobId as string

    // PRODUCER contract: a job named `ingest` lands on `ingestion-web` with the expected payload.
    const queue = ctx.app.get<Queue>(`BullQueue_${INGESTION_WEB_QUEUE}`, { strict: false })
    const job = await queue.getJob(jobId)
    expect(job).toBeDefined()
    expect(job?.name).toBe('ingest')
    expect(job?.data).toMatchObject({
      contentSourceId: sourceId,
      domains: ['Security', 'Architecture'],
    })

    // `source.reingested` audit carries the jobId in `after`.
    const afterReingest = await listAudits(ctx.app, adminAuth)
    const reingestAudit = afterReingest.find((a) => a.action === 'source.reingested')
    expect(reingestAudit?.targetId).toBe(sourceId)
    expect(reingestAudit?.after).toMatchObject({ jobId })

    // List jobs for the source, most recent first.
    const jobs = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs`)
      .set('Authorization', adminAuth)

    expect(jobs.status).toBe(200)
    expect(jobs.body.meta).toBeDefined()
    expect(jobs.body.data.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true)

    // Read a single job's status.
    const jobStatus = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs/${jobId}`)
      .set('Authorization', adminAuth)

    expect(jobStatus.status).toBe(200)
    expect(jobStatus.body.data).toMatchObject({ jobId })
    expect(typeof jobStatus.body.data.state).toBe('string')
    expect('attemptsMade' in jobStatus.body.data).toBe(true)
    expect('failedReason' in jobStatus.body.data).toBe(true)

    // 404 paths for unknown source and unknown job.
    const unknownId = randomUUID()
    const missingSource = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${unknownId}`)
      .set('Authorization', adminAuth)
    expect(missingSource.status).toBe(404)

    const missingSourceDisable = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${unknownId}/disable`)
      .set('Authorization', adminAuth)
    expect(missingSourceDisable.status).toBe(404)

    const missingSourceReingest = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${unknownId}/reingest`)
      .set('Authorization', adminAuth)
    expect(missingSourceReingest.status).toBe(404)

    const missingJob = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs/${randomUUID()}`)
      .set('Authorization', adminAuth)
    expect(missingJob.status).toBe(404)
  })

  it('rejects a non-admin caller with 403 problem+json and an unauthenticated caller with 401', async () => {
    await ctx.harness.registerAndLogin('admin@example.com', 'correcthorse')
    const userToken = await ctx.harness.registerAndLogin('member@example.com', 'correcthorse')

    const forbidden = await supertest(ctx.app.getHttpServer())
      .get(CONTENT_SOURCES_PATH)
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')

    const unauthenticated = await supertest(ctx.app.getHttpServer()).get(CONTENT_SOURCES_PATH)
    expect(unauthenticated.status).toBe(401)
  })
})
