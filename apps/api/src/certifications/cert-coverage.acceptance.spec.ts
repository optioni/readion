import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type CertCoverageAcceptanceHarness,
  createCertCoverageAcceptanceHarness,
} from './test/cert-coverage-acceptance-harness'

describe('cert-coverage acceptance', () => {
  let harness: CertCoverageAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createCertCoverageAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  describe('GET /api/v1/certifications/:id/coverage', () => {
    it('Admin retrieves the coverage report for a draft cert', async () => {
      const adminToken = await harness.issueToken('admin')
      const cert = await harness.seedDraftCertification({
        domains: ['Cloud Concepts', 'Security'],
        questionCount: 65,
      })

      // Source 1: enabled — contributes to Cloud Concepts (12 chunks, below the 20 threshold)
      const source1 = await harness.seedContentSource({ certificationId: cert.id, enabled: true })
      for (let i = 0; i < 12; i++) {
        await harness.seedActiveChunk({
          sourceId: source1,
          certificationId: cert.id,
          domainTags: [{ domain: 'Cloud Concepts', confidence: 0.9 }],
          hash: `cc-${i}`,
        })
      }

      // Source 2: enabled — contributes 25 active chunks to Security
      const source2 = await harness.seedContentSource({ certificationId: cert.id, enabled: true })
      for (let i = 0; i < 25; i++) {
        await harness.seedActiveChunk({
          sourceId: source2,
          certificationId: cert.id,
          domainTags: [{ domain: 'Security', confidence: 0.9 }],
          hash: `sec-${i}`,
        })
      }

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/certifications/${cert.id}/coverage`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()

      const cloudConceptsDomain = (
        res.body.data.domains as Array<{
          name: string
          chunkCount: number
          chunkThreshold: number
          met: boolean
        }>
      ).find((d) => d.name === 'Cloud Concepts')

      expect(cloudConceptsDomain).toBeDefined()
      expect(cloudConceptsDomain?.chunkCount).toBe(12)
      expect(cloudConceptsDomain?.chunkThreshold).toBe(20)
      expect(cloudConceptsDomain?.met).toBe(false)

      expect(res.body.data.met).toBe(false)
      expect(res.body.data.state).toBe('draft')
    })

    it('Non-admin user is forbidden (403)', async () => {
      const userToken = await harness.issueToken('user')
      const cert = await harness.seedDraftCertification({
        domains: ['Cloud Concepts'],
        questionCount: 65,
      })

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/certifications/${cert.id}/coverage`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
      expect(res.headers['content-type']).toMatch('application/problem+json')
      expect(res.body).toMatchObject({
        type: expect.any(String),
        title: expect.any(String),
        status: 403,
      })
    })

    it('Coverage for a missing certification returns 404', async () => {
      const adminToken = await harness.issueToken('admin')

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/certifications/00000000-0000-4000-8000-000000000000/coverage')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch('application/problem+json')
      expect(res.body).toMatchObject({
        type: expect.any(String),
        title: expect.any(String),
        status: 404,
      })
    })
  })
})
