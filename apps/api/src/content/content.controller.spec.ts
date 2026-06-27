import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type ContentAcceptanceHarness,
  createContentAcceptanceHarness,
} from './test/content-acceptance-harness'

describe('ContentController routes', () => {
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

  async function bootstrapAdmin(): Promise<{ auth: string; certificationId: string }> {
    const token = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const certificationId = await harness.seedCertification(['Security', 'Architecture'])
    return { auth: `Bearer ${token}`, certificationId }
  }

  async function createSource(auth: string, certificationId: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/admin/content-sources')
      .set('Authorization', auth)
      .send({ certificationId, type: 'web', url: 'https://example.com/material' })
    return res.body.data.id as string
  }

  it('creates a source with a 201 single-resource envelope', async () => {
    const { auth, certificationId } = await bootstrapAdmin()

    const res = await supertest(app.getHttpServer())
      .post('/api/v1/admin/content-sources')
      .set('Authorization', auth)
      .send({ certificationId, type: 'web', url: 'https://example.com/material' })

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
    const { auth, certificationId } = await bootstrapAdmin()

    const res = await supertest(app.getHttpServer())
      .post('/api/v1/admin/content-sources')
      .set('Authorization', auth)
      .send({ certificationId, type: 'rss', url: 'https://example.com/material' })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
  })

  it('lists sources with a collection envelope, certificationId filter, and default page size 25', async () => {
    const { auth, certificationId } = await bootstrapAdmin()
    const sourceId = await createSource(auth, certificationId)

    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/content-sources')
      .query({ certificationId })
      .set('Authorization', auth)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some((s: { id: string }) => s.id === sourceId)).toBe(true)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 25 })
  })

  it('caps the page size at 100', async () => {
    const { auth, certificationId } = await bootstrapAdmin()

    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/content-sources')
      .query({ certificationId, limit: 1000 })
      .set('Authorization', auth)

    expect(res.status).toBe(200)
    expect(res.body.meta.limit).toBe(100)
  })

  it('reads a single source and 404s for an unknown id', async () => {
    const { auth, certificationId } = await bootstrapAdmin()
    const sourceId = await createSource(auth, certificationId)

    const read = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}`)
      .set('Authorization', auth)
    expect(read.status).toBe(200)
    expect(read.body.data).toMatchObject({ id: sourceId })

    const missing = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${randomUUID()}`)
      .set('Authorization', auth)
    expect(missing.status).toBe(404)
  })

  it('disables and enables a source with 200 responses', async () => {
    const { auth, certificationId } = await bootstrapAdmin()
    const sourceId = await createSource(auth, certificationId)

    const disable = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/disable`)
      .set('Authorization', auth)
    expect(disable.status).toBe(200)
    expect(disable.body.data).toMatchObject({ id: sourceId, enabled: false })

    const enable = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/enable`)
      .set('Authorization', auth)
    expect(enable.status).toBe(200)
    expect(enable.body.data).toMatchObject({ id: sourceId, enabled: true })
  })

  it('reingests an enabled source with 202 and 409s a disabled source', async () => {
    const { auth, certificationId } = await bootstrapAdmin()
    const sourceId = await createSource(auth, certificationId)

    const reingest = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/reingest`)
      .set('Authorization', auth)
    expect(reingest.status).toBe(202)
    expect(reingest.body.data).toMatchObject({ contentSourceId: sourceId })
    expect(typeof reingest.body.data.jobId).toBe('string')
    const jobId = reingest.body.data.jobId as string

    const jobs = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs`)
      .set('Authorization', auth)
    expect(jobs.status).toBe(200)
    expect(jobs.body.meta).toBeDefined()
    expect(jobs.body.data.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true)

    const jobStatus = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs/${jobId}`)
      .set('Authorization', auth)
    expect(jobStatus.status).toBe(200)
    expect(jobStatus.body.data).toMatchObject({ jobId })

    const missingJob = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/content-sources/${sourceId}/jobs/${randomUUID()}`)
      .set('Authorization', auth)
    expect(missingJob.status).toBe(404)

    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/disable`)
      .set('Authorization', auth)

    const blocked = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/content-sources/${sourceId}/reingest`)
      .set('Authorization', auth)
    expect(blocked.status).toBe(409)
  })

  it('forbids a non-admin caller and rejects an unauthenticated one', async () => {
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
