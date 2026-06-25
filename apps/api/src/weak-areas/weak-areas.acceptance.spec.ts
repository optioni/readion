import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createWeakAreasAcceptanceHarness,
  type WeakAreasAcceptanceHarness,
} from './test/weak-areas-acceptance-harness'

describe('WeakAreas (acceptance)', () => {
  let harness: WeakAreasAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createWeakAreasAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  describe('1. WeakArea entity migration', () => {
    it('Migration creates the weak_area table', async () => {
      const moduleRef = harness.moduleRef
      const { EntityManager } = await import('@mikro-orm/core')
      const em = moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      const tables = await conn.execute<{ tablename: string }[]>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'weak_areas'
      `)
      expect(tables).toHaveLength(1)

      const columns = await conn.execute<{ column_name: string; data_type: string }[]>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'weak_areas'
      `)
      const colNames = columns.map((c: { column_name: string; data_type: string }) => c.column_name)
      expect(colNames).toContain('id')
      expect(colNames).toContain('user_certification_id')
      expect(colNames).toContain('domain')
      expect(colNames).toContain('score')
      expect(colNames).toContain('accuracy')
      expect(colNames).toContain('mean_confidence')
      expect(colNames).toContain('response_count')

      const constraints = await conn.execute<
        { constraint_name: string; constraint_type: string }[]
      >(`
        SELECT c.constraint_name, c.constraint_type
        FROM information_schema.table_constraints c
        WHERE c.table_schema = 'public' AND c.table_name = 'weak_areas'
          AND c.constraint_type = 'UNIQUE'
      `)
      expect(constraints.length).toBeGreaterThanOrEqual(1)
    })

    it('A weak area belongs to exactly one enrollment and domain — unique constraint is enforced', async () => {
      const cert = await harness.seedCertification('UC01', 'live')
      const token = await harness.registerAndLogin('uc-test@example.com', 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)
      const chunkId = await harness.seedChunk(cert.id, 'Security')

      const { EntityManager } = await import('@mikro-orm/core')
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      await conn.execute(
        `INSERT INTO weak_areas (id, user_certification_id, domain, score, accuracy, mean_confidence, response_count, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'Security', 50, 0.5, 3.0, 2, now(), now())`,
        [enrollmentId],
      )

      await expect(
        conn.execute(
          `INSERT INTO weak_areas (id, user_certification_id, domain, score, accuracy, mean_confidence, response_count, created_at, updated_at)
           VALUES (gen_random_uuid(), ?, 'Security', 40, 0.4, 2.5, 1, now(), now())`,
          [enrollmentId],
        ),
      ).rejects.toThrow()

      void chunkId
    })
  })

  describe('3. WeakAreasService.recompute', () => {
    async function setupEnrollmentWithResponses() {
      const cert = await harness.seedCertification('RC01', 'live')
      const token = await harness.registerAndLogin(
        `recompute.${Date.now()}@example.com`,
        'correcthorse',
      )
      const enrollmentId = await harness.enroll(token, cert.id)
      const securityChunkId = await harness.seedChunk(cert.id, 'Security')
      const billingChunkId = await harness.seedChunk(cert.id, 'Billing')
      return { cert, token, enrollmentId, securityChunkId, billingChunkId }
    }

    it('Responses are grouped into one row per domain', async () => {
      const { enrollmentId, token, securityChunkId, billingChunkId } =
        await setupEnrollmentWithResponses()

      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 3)
      await harness.seedQuizResponse(enrollmentId, securityChunkId, false, 2)
      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 4)
      await harness.seedQuizResponse(enrollmentId, billingChunkId, true, 5)
      await harness.seedQuizResponse(enrollmentId, billingChunkId, false, 1)

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const { EntityManager } = await import('@mikro-orm/core')
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      const rows = await conn.execute<{ domain: string; response_count: number }[]>(
        `SELECT domain, response_count FROM weak_areas WHERE user_certification_id = ?`,
        [enrollmentId],
      )

      expect(rows).toHaveLength(2)
      const security = rows.find(
        (r: { domain: string; response_count: number }) => r.domain === 'Security',
      )
      const billing = rows.find(
        (r: { domain: string; response_count: number }) => r.domain === 'Billing',
      )
      expect(security?.response_count).toBe(3)
      expect(billing?.response_count).toBe(2)
    })

    it('Recompute is idempotent — same results on two consecutive runs without new responses', async () => {
      const { enrollmentId, token, securityChunkId } = await setupEnrollmentWithResponses()

      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 3)
      await harness.seedQuizResponse(enrollmentId, securityChunkId, false, 2)

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const { EntityManager } = await import('@mikro-orm/core')
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      const after1 = await conn.execute<
        { score: number; accuracy: number; response_count: number }[]
      >(`SELECT score, accuracy, response_count FROM weak_areas WHERE user_certification_id = ?`, [
        enrollmentId,
      ])

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const after2 = await conn.execute<
        { score: number; accuracy: number; response_count: number }[]
      >(`SELECT score, accuracy, response_count FROM weak_areas WHERE user_certification_id = ?`, [
        enrollmentId,
      ])

      expect(after1).toEqual(after2)
    })

    it('A domain with no responses produces no row — stale rows are removed', async () => {
      const { enrollmentId, token, securityChunkId, billingChunkId } =
        await setupEnrollmentWithResponses()

      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 3)
      await harness.seedQuizResponse(enrollmentId, billingChunkId, false, 2)

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const { EntityManager } = await import('@mikro-orm/core')
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      const before = await conn.execute<{ domain: string }[]>(
        `SELECT domain FROM weak_areas WHERE user_certification_id = ?`,
        [enrollmentId],
      )
      expect(before.map((r: { domain: string }) => r.domain).sort()).toEqual([
        'Billing',
        'Security',
      ])

      await conn.execute(
        `DELETE FROM quiz_responses WHERE user_certification_id = ? AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(question_snapshot->'provenance'->'sourceChunkIds') elem WHERE elem = ?
        )`,
        [enrollmentId, billingChunkId],
      )

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const after = await conn.execute<{ domain: string }[]>(
        `SELECT domain FROM weak_areas WHERE user_certification_id = ?`,
        [enrollmentId],
      )
      expect(after.map((r: { domain: string }) => r.domain)).toEqual(['Security'])
    })

    it('Responses with an unresolvable source chunk are skipped without error', async () => {
      const { enrollmentId, token, securityChunkId } = await setupEnrollmentWithResponses()

      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 3)
      await harness.seedQuizResponse(enrollmentId, '00000000-0000-4000-8000-000000000099', false, 2)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].domain).toBe('Security')
    })

    it('Recompute reflects newly recorded answers', async () => {
      const { enrollmentId, token, securityChunkId } = await setupEnrollmentWithResponses()

      await harness.seedQuizResponse(enrollmentId, securityChunkId, true, 3)

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const { EntityManager } = await import('@mikro-orm/core')
      const em = harness.moduleRef.get(EntityManager).fork()
      const conn = em.getConnection()

      const after1 = await conn.execute<{ response_count: number; score: number }[]>(
        `SELECT response_count, score FROM weak_areas WHERE user_certification_id = ? AND domain = 'Security'`,
        [enrollmentId],
      )
      expect(after1[0]?.response_count).toBe(1)

      await harness.seedQuizResponse(enrollmentId, securityChunkId, false, 5)

      await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)

      const after2 = await conn.execute<{ response_count: number; score: number }[]>(
        `SELECT response_count, score FROM weak_areas WHERE user_certification_id = ? AND domain = 'Security'`,
        [enrollmentId],
      )
      expect(after2[0]?.response_count).toBe(2)
      expect(after2[0]?.score).not.toBe(after1[0]?.score)
    })
  })

  describe('4. GET /api/v1/user-certifications/:id/weak-areas', () => {
    it('returns 401 without authentication', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications/00000000-0000-4000-8000-000000000001/weak-areas')
        .expect(401)
      void res
    })

    it('Weakest domain is returned first', async () => {
      const cert = await harness.seedCertification('WA01', 'live')
      const token = await harness.registerAndLogin(`wa1.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)

      const securityChunk = await harness.seedChunk(cert.id, 'Security')
      const billingChunk = await harness.seedChunk(cert.id, 'Billing')

      await harness.seedQuizResponse(enrollmentId, securityChunk, false, 5)
      await harness.seedQuizResponse(enrollmentId, securityChunk, false, 5)
      await harness.seedQuizResponse(enrollmentId, billingChunk, true, 5)
      await harness.seedQuizResponse(enrollmentId, billingChunk, true, 5)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.data).toHaveLength(2)
      expect(res.body.data[0].domain).toBe('Security')
      expect(res.body.data[1].domain).toBe('Billing')
      expect(res.body.data[0].score).toBeLessThan(res.body.data[1].score)
      expect(res.body.data[0]).toHaveProperty('id')
      expect(res.body.data[0]).toHaveProperty('domain')
      expect(res.body.data[0]).toHaveProperty('score')
    })

    it('Cold start returns an empty list', async () => {
      const cert = await harness.seedCertification('WA02', 'live')
      const token = await harness.registerAndLogin(`wa2.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.data).toEqual([])
    })

    it('Endpoint reflects newly recorded answers without an explicit recompute call', async () => {
      const cert = await harness.seedCertification('WA03', 'live')
      const token = await harness.registerAndLogin(`wa3.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)
      const chunkId = await harness.seedChunk(cert.id, 'Security')

      await harness.seedQuizResponse(enrollmentId, chunkId, true, 3)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].domain).toBe('Security')
      expect(res.body.data[0].score).toBeGreaterThan(0)
    })

    it('Another user cannot read the enrollment weak areas — RFC 7807 error', async () => {
      const cert = await harness.seedCertification('WA04', 'live')
      const token = await harness.registerAndLogin(`wa4a.${Date.now()}@example.com`, 'correcthorse')
      const otherToken = await harness.registerAndLogin(
        `wa4b.${Date.now()}@example.com`,
        'correcthorse',
      )
      const enrollmentId = await harness.enroll(token, cert.id)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch('application/problem+json')
    })

    it('Tie-break: equal scores ranked by responseCount desc then domain asc', async () => {
      const cert = await harness.seedCertification('WA05', 'live')
      const token = await harness.registerAndLogin(`wa5.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)

      const secChunk = await harness.seedChunk(cert.id, 'Security')
      const bilChunk = await harness.seedChunk(cert.id, 'Billing')

      await harness.seedQuizResponse(enrollmentId, secChunk, false, 3)
      await harness.seedQuizResponse(enrollmentId, secChunk, false, 3)
      await harness.seedQuizResponse(enrollmentId, bilChunk, false, 3)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/weak-areas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.data[0].domain).toBe('Security')
      expect(res.body.data[1].domain).toBe('Billing')
    })
  })

  describe('5. ?include=weakAreas on UserCertification resource', () => {
    it('Include expands the weak areas inline under relationships.weakAreas.data', async () => {
      const cert = await harness.seedCertification('INC01', 'live')
      const token = await harness.registerAndLogin(`inc1.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)
      const chunkId = await harness.seedChunk(cert.id, 'Security')
      await harness.seedQuizResponse(enrollmentId, chunkId, true, 3)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}?include=weakAreas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.relationships.weakAreas.data).toBeDefined()
      expect(Array.isArray(res.body.relationships.weakAreas.data)).toBe(true)
      expect(res.body.relationships.weakAreas.data[0]).toHaveProperty('id')
      expect(res.body.relationships.weakAreas.data[0]).toHaveProperty('domain')
      expect(res.body.relationships.weakAreas.data[0]).toHaveProperty('score')
    })

    it('Without include param only href is present, data is absent', async () => {
      const cert = await harness.seedCertification('INC02', 'live')
      const token = await harness.registerAndLogin(`inc2.${Date.now()}@example.com`, 'correcthorse')
      const enrollmentId = await harness.enroll(token, cert.id)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.relationships.weakAreas.href).toContain(
        `/user-certifications/${enrollmentId}/weak-areas`,
      )
      expect(res.body.relationships.weakAreas).not.toHaveProperty('data')
    })
  })
})
