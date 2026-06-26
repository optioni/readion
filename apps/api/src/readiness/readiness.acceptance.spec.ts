import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ReadinessService } from './readiness.service'
import {
  createReadinessAcceptanceHarness,
  type ReadinessAcceptanceHarness,
} from './test/readiness-acceptance-harness'

const DOMAINS = [
  { name: 'Security', weight: 50 },
  { name: 'Billing', weight: 50 },
]

describe('Readiness (acceptance)', () => {
  let harness: ReadinessAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createReadinessAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('a fresh enrollment reads readiness as not-yet-calibrated', async () => {
    const cert = await harness.seedCertification('RDY01', 'live', DOMAINS)
    const token = await harness.registerAndLogin(`rdy1.${Date.now()}@example.com`, 'correcthorse')
    const enrollmentId = await harness.enroll(token, cert.id)

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.data.calibrated).toBe(false)
    expect(res.body.data.score).toBeNull()
  })

  it('reaching the calibration threshold returns a numeric 0–100 score and exposes readinessScore on the resource', async () => {
    const cert = await harness.seedCertification('RDY02', 'live', DOMAINS)
    const token = await harness.registerAndLogin(`rdy2.${Date.now()}@example.com`, 'correcthorse')
    const enrollmentId = await harness.enroll(token, cert.id)
    const securityChunk = await harness.seedChunk(cert.id, 'Security')
    const billingChunk = await harness.seedChunk(cert.id, 'Billing')

    for (let i = 0; i < 6; i++) {
      await harness.seedQuizResponse(enrollmentId, securityChunk, true, 4)
    }
    for (let i = 0; i < 6; i++) {
      await harness.seedQuizResponse(enrollmentId, billingChunk, true, 4)
    }

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.data.calibrated).toBe(true)
    expect(typeof res.body.data.score).toBe('number')
    expect(res.body.data.score).toBeGreaterThanOrEqual(0)
    expect(res.body.data.score).toBeLessThanOrEqual(100)

    const resource = await supertest(app.getHttpServer())
      .get(`/api/v1/user-certifications/${enrollmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(typeof resource.body.data.readinessScore).toBe('number')
    expect(resource.body.data.readinessScore).toBe(res.body.data.score)
  })

  it('an uncalibrated enrollment exposes a null readinessScore on the resource', async () => {
    const cert = await harness.seedCertification('RDY03', 'live', DOMAINS)
    const token = await harness.registerAndLogin(`rdy3.${Date.now()}@example.com`, 'correcthorse')
    const enrollmentId = await harness.enroll(token, cert.id)

    const resource = await supertest(app.getHttpServer())
      .get(`/api/v1/user-certifications/${enrollmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(resource.body.data.readinessScore).toBeNull()
  })

  it('another user requesting the enrollment readiness gets 404', async () => {
    const cert = await harness.seedCertification('RDY04', 'live', DOMAINS)
    const token = await harness.registerAndLogin(`rdy4a.${Date.now()}@example.com`, 'correcthorse')
    const otherToken = await harness.registerAndLogin(
      `rdy4b.${Date.now()}@example.com`,
      'correcthorse',
    )
    const enrollmentId = await harness.enroll(token, cert.id)

    const res = await supertest(app.getHttpServer())
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch('application/problem+json')
  })

  describe('ReadinessService.compute', () => {
    it('returns not-yet-calibrated for a cold enrollment', async () => {
      const cert = await harness.seedCertification('SVC01', 'live', DOMAINS)
      const token = await harness.registerAndLogin(`svc1.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)

      const service = harness.moduleRef.get(ReadinessService)
      const result = await service.compute(enrollmentId)

      expect(result.calibrated).toBe(false)
      expect(result.score).toBeNull()
    })

    it('reflects newly recorded answers on a subsequent call', async () => {
      const cert = await harness.seedCertification('SVC02', 'live', DOMAINS)
      const token = await harness.registerAndLogin(`svc2.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)
      const securityChunk = await harness.seedChunk(cert.id, 'Security')
      const service = harness.moduleRef.get(ReadinessService)

      for (let i = 0; i < 12; i++) {
        await harness.seedQuizResponse(enrollmentId, securityChunk, true, 5)
      }
      const strong = await service.compute(enrollmentId)
      expect(strong.calibrated).toBe(true)

      for (let i = 0; i < 12; i++) {
        await harness.seedQuizResponse(enrollmentId, securityChunk, false, 5)
      }
      const weaker = await service.compute(enrollmentId)
      expect(weaker.calibrated).toBe(true)
      if (strong.calibrated && weaker.calibrated) {
        expect(weaker.score).toBeLessThan(strong.score)
      }
    })

    it('a submitted diagnostic calibrates below the answer threshold', async () => {
      const cert = await harness.seedCertification('SVC03', 'live', DOMAINS)
      const token = await harness.registerAndLogin(`svc3.${Date.now()}@example.com`, 'correcthorse')
      const userId = await harness.getUserIdFromToken(token)
      const enrollmentId = await harness.enroll(token, cert.id)
      await harness.seedSubmittedDiagnostic(enrollmentId, userId, 65)

      const service = harness.moduleRef.get(ReadinessService)
      const result = await service.compute(enrollmentId)

      expect(result.calibrated).toBe(true)
      expect(typeof result.score).toBe('number')
    })

    it('does not create a readiness table or migration of its own', async () => {
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()
      const tables = await conn.execute<{ tablename: string }[]>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN ('readiness', 'readiness_scores', 'readiness_snapshots')
      `)
      expect(tables).toHaveLength(0)
    })
  })
})
