import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createQuizAcceptanceHarness,
  type QuizAcceptanceHarness,
} from './test/quiz-acceptance-harness'

const FIXTURE_PROVENANCE = {
  sourceChunkIds: ['chunk-1'],
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  verdict: { pass: true, score: 0.95, distractorFindings: [] },
  score: 0.95,
}

const FIXTURE_ITEM = {
  question: 'What does Amazon EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS resolution', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

const FIXTURE_CACHE_KEY = 'acceptance-test-question-key'

describe('QuizController (acceptance)', () => {
  let harness: QuizAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createQuizAcceptanceHarness()
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
    const token = await harness.registerAndLogin('quiz-user@example.com', 'correcthorse')
    const otherToken = await harness.registerAndLogin('other-user@example.com', 'correcthorse')
    const enrollmentId = await harness.enroll(token, liveCert.id)

    return { liveCert, draftCert, token, otherToken, enrollmentId }
  }

  describe('POST /api/v1/quiz/generate', () => {
    it('returns 401 without authentication', async () => {
      const res = await supertest(app.getHttpServer()).post('/api/v1/quiz/generate').send({
        userCertificationId: '00000000-0000-4000-8000-000000000001',
        domain: 'compute',
        difficulty: 'beginner',
      })

      expect(res.status).toBe(401)
    })

    it('returns 422 for invalid request body', async () => {
      const { token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ domain: 'compute' })

      expect(res.status).toBe(422)
      expect(res.headers['content-type']).toMatch('application/problem+json')
    })

    it('returns 404 when enrollment does not belong to user', async () => {
      const { liveCert, otherToken } = await setupScenario()
      const otherEnrollmentId = await harness.enroll(otherToken, liveCert.id)

      const token2 = await harness.registerAndLogin('third@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/generate')
        .set('Authorization', `Bearer ${token2}`)
        .send({ userCertificationId: otherEnrollmentId, domain: 'compute', difficulty: 'beginner' })

      expect(res.status).toBe(404)
    })

    it('returns 422 when certification is not live', async () => {
      const { draftCert, token } = await setupScenario()
      const userId = await harness.getUserIdFromToken(token)
      const draftEnrollmentId = await harness.seedEnrollment(userId, draftCert.id)

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ userCertificationId: draftEnrollmentId, domain: 'compute', difficulty: 'beginner' })

      expect(res.status).toBe(422)
    })

    it('returns insufficient_material when no chunks available for domain', async () => {
      const { enrollmentId, token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          domain: 'nonexistent-domain',
          difficulty: 'beginner',
        })

      expect(res.status).toBe(200)
      expect(res.body.data.type).toBe('insufficient_material')
      expect(res.body.data.domain).toBe('nonexistent-domain')
    })
  })

  describe('POST /api/v1/quiz/:questionId/submit', () => {
    it('returns 401 without authentication', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/some-question-id/submit')
        .send({
          userCertificationId: '00000000-0000-4000-8000-000000000001',
          answer: 'A',
          confidence: 3,
          timeTakenMs: 5000,
        })

      expect(res.status).toBe(401)
    })

    it('returns 422 for invalid request body', async () => {
      const { token } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/some-question-id/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: 'A' })

      expect(res.status).toBe(422)
    })

    it('scores correct answer and returns 201 with result envelope', async () => {
      const { token, enrollmentId, liveCert } = await setupScenario()

      await harness.seedCacheEntry(
        FIXTURE_CACHE_KEY,
        ['chunk-1'],
        FIXTURE_ITEM,
        FIXTURE_PROVENANCE,
        'multiple_choice',
      )

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/quiz/${FIXTURE_CACHE_KEY}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          answer: 'Scalable computing capacity',
          confidence: 4,
          timeTakenMs: 12000,
        })

      expect(res.status).toBe(201)
      expect(res.body.data.correct).toBe(true)
      expect(res.body.data.answer).toBe('Scalable computing capacity')
      expect(res.body.data.confidence).toBe(4)
      expect(res.body.data.timeTakenMs).toBe(12000)
      expect(res.body.data.userCertificationId).toBe(enrollmentId)
      expect(res.body.data.id).toBeDefined()
      void liveCert
    })

    it('scores incorrect answer', async () => {
      const { token, enrollmentId } = await setupScenario()
      await harness.seedCacheEntry(
        FIXTURE_CACHE_KEY,
        ['chunk-1'],
        FIXTURE_ITEM,
        FIXTURE_PROVENANCE,
        'multiple_choice',
      )

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/quiz/${FIXTURE_CACHE_KEY}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          answer: 'Object storage',
          confidence: 2,
          timeTakenMs: 5000,
        })

      expect(res.status).toBe(201)
      expect(res.body.data.correct).toBe(false)
    })

    it('returns 422 when question handle is expired', async () => {
      const { token, enrollmentId } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/expired-question-key/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          answer: 'Scalable computing capacity',
          confidence: 3,
          timeTakenMs: 5000,
        })

      expect(res.status).toBe(422)
    })
  })

  describe('POST /api/v1/quiz/:questionId/report', () => {
    it('returns 401 without authentication', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/some-question-id/report')
        .send({
          userCertificationId: '00000000-0000-4000-8000-000000000001',
          reason: 'wrong answer',
        })

      expect(res.status).toBe(401)
    })

    it('returns 422 when question is expired', async () => {
      const { token, enrollmentId } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/expired-key/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ userCertificationId: enrollmentId, reason: 'wrong answer key' })

      expect(res.status).toBe(422)
    })

    it('returns 204 and evicts question from cache on successful report', async () => {
      const { token, enrollmentId } = await setupScenario()
      await harness.seedCacheEntry(
        FIXTURE_CACHE_KEY,
        ['chunk-1'],
        FIXTURE_ITEM,
        FIXTURE_PROVENANCE,
        'multiple_choice',
      )

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/quiz/${FIXTURE_CACHE_KEY}/report`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userCertificationId: enrollmentId, reason: 'The answer key is incorrect' })

      expect(res.status).toBe(204)
    })

    it('returns 422 for missing reason', async () => {
      const { token, enrollmentId } = await setupScenario()

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/quiz/some-key/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ userCertificationId: enrollmentId })

      expect(res.status).toBe(422)
    })
  })
})
