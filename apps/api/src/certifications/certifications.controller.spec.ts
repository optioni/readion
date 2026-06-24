import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Certification } from '@readion/db'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type CertificationsAcceptanceHarness,
  createCertificationsAcceptanceHarness,
} from './test/certifications-acceptance-harness'

describe('CertificationsController', () => {
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

  function seedCert(overrides: { code: string; name?: string; state?: 'draft' | 'live' }) {
    const cert = em.create(Certification, {
      name: overrides.name ?? 'AWS Cloud Practitioner',
      provider: 'AWS',
      code: overrides.code,
      domains: [
        { name: 'Cloud Concepts', weight: 24 },
        { name: 'Security and Compliance', weight: 30 },
        { name: 'Cloud Technology and Services', weight: 34 },
        { name: 'Billing, Pricing, and Support', weight: 12 },
      ],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: overrides.state ?? 'live',
    })
    em.persist(cert)
    return em.flush().then(() => cert)
  }

  describe('GET /api/v1/certifications', () => {
    it('returns 200 with collection envelope containing only live certs', async () => {
      await seedCert({ code: 'LIVE-01', state: 'live' })
      await seedCert({ code: 'DRAFT-01', state: 'draft' })

      const res = await supertest(app.getHttpServer()).get('/api/v1/certifications')
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].code).toBe('LIVE-01')
      expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 25 })
    })

    it('returns empty data array when no live certs exist', async () => {
      await seedCert({ code: 'DRAFT-01', state: 'draft' })

      const res = await supertest(app.getHttpServer()).get('/api/v1/certifications')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.total).toBe(0)
    })

    it('caps the limit query param at 100', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/certifications?limit=500')
      expect(res.status).toBe(200)
      expect(res.body.meta.limit).toBe(100)
    })

    it('respects page and limit query params', async () => {
      for (let i = 1; i <= 3; i++) {
        await seedCert({ code: `CERT-0${i}`, name: `Cert ${i}`, state: 'live' })
      }

      const res = await supertest(app.getHttpServer()).get('/api/v1/certifications?page=2&limit=2')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta).toMatchObject({ total: 3, page: 2, limit: 2 })
    })
  })

  describe('GET /api/v1/certifications/:id', () => {
    it('returns 200 single-resource envelope with relationships and cert fields', async () => {
      const cert = await seedCert({ code: 'CLF-C02', state: 'live' })

      const res = await supertest(app.getHttpServer()).get(`/api/v1/certifications/${cert.id}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        id: cert.id,
        name: 'AWS Cloud Practitioner',
        provider: 'AWS',
        code: 'CLF-C02',
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
      })
      expect(res.body.data.domains).toHaveLength(4)
      expect(res.body.relationships).toBeDefined()
    })

    it('does not expose user-specific or internal fields', async () => {
      const cert = await seedCert({ code: 'CLF-C02', state: 'live' })

      const res = await supertest(app.getHttpServer()).get(`/api/v1/certifications/${cert.id}`)
      expect(res.body.data).not.toHaveProperty('provenance')
      expect(res.body.data).not.toHaveProperty('verifiedAt')
      expect(res.body.data).not.toHaveProperty('readinessScore')
    })

    it('returns 404 problem-details for unknown id', async () => {
      const res = await supertest(app.getHttpServer()).get(
        '/api/v1/certifications/00000000-0000-4000-8000-000000000000',
      )
      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch('application/problem+json')
      expect(res.body.type).toBe('/errors/not-found')
      expect(res.body.status).toBe(404)
    })

    it('returns 404 for a draft certification id', async () => {
      const cert = await seedCert({ code: 'DRAFT-99', state: 'draft' })
      const res = await supertest(app.getHttpServer()).get(`/api/v1/certifications/${cert.id}`)
      expect(res.status).toBe(404)
    })
  })
})
