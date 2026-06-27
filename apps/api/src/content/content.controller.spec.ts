import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  bootstrapAdmin,
  CONTENT_SOURCES_PATH,
  createWebSource,
  listAuditCount,
} from './test/content-requests'
import { useContentHarness } from './test/content-test-context'

describe('ContentController routes', () => {
  const ctx = useContentHarness()

  async function createSourceId(auth: string, certificationId: string): Promise<string> {
    const res = await createWebSource(ctx.app, auth, certificationId)
    return res.body.data.id as string
  }

  it('creates a source with a 201 single-resource envelope', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)

    const res = await createWebSource(ctx.app, auth, certificationId)

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      certificationId,
      type: 'web',
      url: 'https://example.com/material',
      enabled: true,
    })
    expect(res.body.relationships).toBeDefined()
  })

  it('rejects an invalid source type with 400 problem+json', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)

    const res = await supertest(ctx.app.getHttpServer())
      .post(CONTENT_SOURCES_PATH)
      .set('Authorization', auth)
      .send({ certificationId, type: 'rss', url: 'https://example.com/material' })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  it('404s a non-existent certification with problem+json and writes no rows', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)
    const unknownCertId = randomUUID()

    const res = await supertest(ctx.app.getHttpServer())
      .post(CONTENT_SOURCES_PATH)
      .set('Authorization', auth)
      .send({ certificationId: unknownCertId, type: 'web', url: 'https://example.com/material' })

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')

    expect(await listAuditCount(ctx.app, auth, 'source.added')).toBe(0)

    const list = await supertest(ctx.app.getHttpServer())
      .get(CONTENT_SOURCES_PATH)
      .query({ certificationId })
      .set('Authorization', auth)
    expect(list.body.data).toHaveLength(0)
  })

  it('lists sources with a collection envelope, certificationId filter, and default page size 25', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)
    const sourceId = await createSourceId(auth, certificationId)

    const res = await supertest(ctx.app.getHttpServer())
      .get(CONTENT_SOURCES_PATH)
      .query({ certificationId })
      .set('Authorization', auth)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some((s: { id: string }) => s.id === sourceId)).toBe(true)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 25 })
  })

  it('caps the page size at 100', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)

    const res = await supertest(ctx.app.getHttpServer())
      .get(CONTENT_SOURCES_PATH)
      .query({ certificationId, limit: 1000 })
      .set('Authorization', auth)

    expect(res.status).toBe(200)
    expect(res.body.meta.limit).toBe(100)
  })

  it('reads a single source and 404s for an unknown id', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)
    const sourceId = await createSourceId(auth, certificationId)

    const read = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}`)
      .set('Authorization', auth)
    expect(read.status).toBe(200)
    expect(read.body.data).toMatchObject({ id: sourceId })

    const missing = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${randomUUID()}`)
      .set('Authorization', auth)
    expect(missing.status).toBe(404)
  })

  it('disables and enables a source with 200 responses', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)
    const sourceId = await createSourceId(auth, certificationId)

    const disable = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/disable`)
      .set('Authorization', auth)
    expect(disable.status).toBe(200)
    expect(disable.body.data).toMatchObject({ id: sourceId, enabled: false })

    const enable = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/enable`)
      .set('Authorization', auth)
    expect(enable.status).toBe(200)
    expect(enable.body.data).toMatchObject({ id: sourceId, enabled: true })
  })

  it('reingests an enabled source with 202 and 409s a disabled source', async () => {
    const { auth, certificationId } = await bootstrapAdmin(ctx.harness)
    const sourceId = await createSourceId(auth, certificationId)

    const reingest = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/reingest`)
      .set('Authorization', auth)
    expect(reingest.status).toBe(202)
    expect(reingest.body.data).toMatchObject({ contentSourceId: sourceId })
    expect(typeof reingest.body.data.jobId).toBe('string')
    const jobId = reingest.body.data.jobId as string

    const jobs = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs`)
      .set('Authorization', auth)
    expect(jobs.status).toBe(200)
    expect(jobs.body.meta).toBeDefined()
    expect(jobs.body.data.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true)

    const jobStatus = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs/${jobId}`)
      .set('Authorization', auth)
    expect(jobStatus.status).toBe(200)
    expect(jobStatus.body.data).toMatchObject({ jobId })

    const missingJob = await supertest(ctx.app.getHttpServer())
      .get(`${CONTENT_SOURCES_PATH}/${sourceId}/jobs/${randomUUID()}`)
      .set('Authorization', auth)
    expect(missingJob.status).toBe(404)

    await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/disable`)
      .set('Authorization', auth)

    const blocked = await supertest(ctx.app.getHttpServer())
      .post(`${CONTENT_SOURCES_PATH}/${sourceId}/reingest`)
      .set('Authorization', auth)
    expect(blocked.status).toBe(409)
    expect(blocked.headers['content-type']).toContain('application/problem+json')
  })

  it('forbids a non-admin caller and rejects an unauthenticated one', async () => {
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
