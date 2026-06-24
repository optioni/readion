import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Certification } from '@readion/db'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type CertificationsAcceptanceHarness,
  createCertificationsAcceptanceHarness,
} from './test/certifications-acceptance-harness'

describe('certifications acceptance', () => {
  let harness: CertificationsAcceptanceHarness
  let app: INestApplication
  let em: EntityManager

  beforeAll(async () => {
    harness = await createCertificationsAcceptanceHarness()
    app = harness.app
    em = harness.moduleRef.get(EntityManager).fork()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
    em = harness.moduleRef.get(EntityManager).fork()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  async function seedLiveCert(code: string) {
    const cert = em.create(Certification, {
      name: `Cert ${code}`,
      provider: 'AWS',
      code,
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
    })
    em.persist(cert)
    await em.flush()
    return cert
  }

  it('GET /api/v1/certifications returns 200 with collection envelope listing only live certs', async () => {
    const live = await seedLiveCert('LIVE-01')
    const draft = em.create(Certification, {
      name: 'Draft Cert',
      provider: 'AWS',
      code: 'DRAFT-01',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'draft',
    })
    em.persist(draft)
    await em.flush()

    const res = await supertest(app.getHttpServer()).get('/api/v1/certifications')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].state).toBe('live')
    expect(res.body.data[0].id).toBe(live.id)
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 25 })
  })

  it('GET /api/v1/certifications returns empty list when all certs are draft', async () => {
    const draft = em.create(Certification, {
      name: 'Draft Only',
      provider: 'AWS',
      code: 'DRAFT-02',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'draft',
    })
    em.persist(draft)
    await em.flush()

    const res = await supertest(app.getHttpServer()).get('/api/v1/certifications')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })

  it('GET /api/v1/certifications/:id returns single-resource envelope for live cert', async () => {
    const cert = await seedLiveCert('CLF-C02')

    const res = await supertest(app.getHttpServer()).get(`/api/v1/certifications/${cert.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: cert.id,
      code: 'CLF-C02',
      provider: 'AWS',
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
    })
    expect(res.body.relationships).toBeDefined()
  })

  it('GET /api/v1/certifications/:id returns 404 RFC 7807 for missing cert', async () => {
    const res = await supertest(app.getHttpServer()).get(
      '/api/v1/certifications/00000000-0000-4000-8000-000000000000',
    )
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch('application/problem+json')
    expect(res.body).toMatchObject({
      type: '/errors/not-found',
      title: expect.any(String),
      status: 404,
    })
  })
})
