import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createUserCertificationsAcceptanceHarness,
  type UserCertificationsAcceptanceHarness,
} from './test/user-certifications-acceptance-harness'

describe('UserCertificationsController', () => {
  let harness: UserCertificationsAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createUserCertificationsAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  async function setupScenario() {
    const liveCert = await harness.seedCertification('CLF-C02', 'live')
    const draftCert = await harness.seedCertification('DRAFT-01', 'draft')
    const token = await harness.registerAndLogin('user@example.com', 'correcthorse')
    const otherToken = await harness.registerAndLogin('other@example.com', 'correcthorse')
    return { liveCert, draftCert, token, otherToken }
  }

  describe('POST /api/v1/user-certifications', () => {
    it('returns 201 with single-resource envelope on successful enrollment', async () => {
      const { liveCert, token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId: liveCert.id })

      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({
        certificationId: liveCert.id,
        status: 'active',
      })
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.enrolledAt).toBeDefined()
      expect(res.body.relationships).toBeDefined()
    })

    it('returns 404 for a draft certification', async () => {
      const { draftCert, token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId: draftCert.id })

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch('application/problem+json')
      expect(res.body.status).toBe(404)
    })

    it('returns 404 for a non-existent certification', async () => {
      const { token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId: '00000000-0000-4000-8000-000000000000' })

      expect(res.status).toBe(404)
    })

    it('returns 409 when already actively enrolled', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })

      expect(res.status).toBe(409)
    })

    it('returns 401 without authentication', async () => {
      const { liveCert } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .send({ certificationId: liveCert.id })

      expect(res.status).toBe(401)
    })

    it('returns 422 for missing or invalid certificationId', async () => {
      const { token } = await setupScenario()
      const auth = `Bearer ${token}`

      const missingId = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({})

      expect(missingId.status).toBe(422)

      const invalidUuid = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: 'not-a-uuid' })

      expect(invalidUuid.status).toBe(422)
    })

    it('returns 201 restoring an archived enrollment', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', auth)

      const restore = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })

      expect(restore.status).toBe(201)
      expect(restore.body.data.id).toBe(enrollmentId)
      expect(restore.body.data.status).toBe('active')
    })
  })

  describe('GET /api/v1/user-certifications', () => {
    it('returns 200 with collection envelope of active enrollments by default', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications')
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].status).toBe('active')
      expect(res.body.meta.total).toBe(1)
    })

    it('filters by archived status', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', auth)

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications?status=archived')
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].status).toBe('archived')
    })

    it("does not include another user's enrollments", async () => {
      const { liveCert, token, otherToken } = await setupScenario()

      await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ certificationId: liveCert.id })

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)

      expect(res.body.data).toHaveLength(0)
    })

    it('returns empty list when no enrollments', async () => {
      const { token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.total).toBe(0)
    })
  })

  describe('GET /api/v1/user-certifications/:id', () => {
    it('returns 200 single-resource envelope for own enrollment', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(enrollmentId)
      expect(res.body.relationships).toBeDefined()
    })

    it("returns 404 for another user's enrollment", async () => {
      const { liveCert, token, otherToken } = await setupScenario()

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })

    it('returns 404 for a missing enrollment id', async () => {
      const { token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/user-certifications/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/user-certifications/:id', () => {
    it('returns 200 and updates the override', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', auth)
        .send({ sessionDefaults: { learningStyle: 'spaced-repetition' } })

      expect(res.status).toBe(200)
      expect(res.body.data.sessionDefaults.learningStyle).toBe('spaced-repetition')
    })

    it('returns 422 for invalid override values', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', auth)
        .send({ sessionDefaults: { difficulty: 'impossible' } })

      expect(res.status).toBe(422)
    })

    it("returns 404 for another user's enrollment", async () => {
      const { liveCert, token, otherToken } = await setupScenario()

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .patch(`/api/v1/user-certifications/${enrollmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionDefaults: { duration: 30 } })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/user-certifications/:id/archive', () => {
    it('returns 200 with archived enrollment', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('archived')
    })

    it("returns 404 for another user's enrollment", async () => {
      const { liveCert, token, otherToken } = await setupScenario()

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/user-certifications/:id/restore', () => {
    it('returns 200 with restored enrollment', async () => {
      const { liveCert, token } = await setupScenario()
      const auth = `Bearer ${token}`

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', auth)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', auth)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/restore`)
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('active')
    })

    it("returns 404 for another user's enrollment", async () => {
      const { liveCert, token, otherToken } = await setupScenario()

      const enroll = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ certificationId: liveCert.id })
      const enrollmentId = enroll.body.data.id as string

      await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
        .set('Authorization', `Bearer ${otherToken}`)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/restore`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })
})
