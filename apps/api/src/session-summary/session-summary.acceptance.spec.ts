import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createSessionSummaryAcceptanceHarness,
  SESSION_SUMMARY_CORRECT_ANSWER,
  SESSION_SUMMARY_WRONG_ANSWER,
  type SessionSummaryAcceptanceHarness,
} from './test/session-summary-acceptance-harness'

type SessionItemPayload = { index: number; type: string; content: string; completed: boolean }
type QuizContent = { questionId: string; question: string; options: string[]; format: string }

describe('session summary acceptance', () => {
  let harness: SessionSummaryAcceptanceHarness

  beforeAll(async () => {
    harness = await createSessionSummaryAcceptanceHarness()
  }, 180_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  // ---------------------------------------------------------------------------
  // Study session: GET /api/v1/sessions/:id/summary
  // ---------------------------------------------------------------------------

  describe('GET /api/v1/sessions/:id/summary — study path', () => {
    it('returns summary with accuracy, per-domain breakdown, weak-area deltas, readiness, strongest/weakest question, and next-focus for an ended session', async () => {
      const cert = await harness.seedCertification('SUM-STUDY-01')
      for (const domain of [
        'Security',
        'Security',
        'Security',
        'Networking',
        'Networking',
        'Networking',
      ]) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin('sum-study-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', auth)
        .send({ durationMinutes: 30, contentMix: 'quiz-heavy', difficulty: 'intermediate' })
      expect(create.status).toBe(201)
      const sessionId = create.body.data.id as string

      const getItems = await harness
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', auth)
      expect(getItems.status).toBe(200)

      const items = getItems.body.data.items as SessionItemPayload[]
      const quizItems = items.filter((i) => i.type === 'quiz')

      // Answer quiz items: first half correct (high-confidence), second half wrong (unsure)
      let correctCount = 0
      for (let i = 0; i < quizItems.length; i++) {
        const item = quizItems[i]!
        const parsed = JSON.parse(item.content) as QuizContent
        const isCorrect = i < Math.ceil(quizItems.length / 2)
        const answer = isCorrect ? SESSION_SUMMARY_CORRECT_ANSWER : SESSION_SUMMARY_WRONG_ANSWER
        const confidence = isCorrect ? 4 : 1

        const submitRes = await harness
          .getRequest()
          .post(`/api/v1/quiz/${parsed.questionId}/submit`)
          .set('Authorization', auth)
          .send({ userCertificationId: enrollmentId, answer, confidence, timeTakenMs: 1500 })
        expect(submitRes.status).toBe(201)

        if (isCorrect) correctCount++
      }

      // Complete all session items so the session ends as completed/partial
      for (const item of items) {
        await harness
          .getRequest()
          .post(`/api/v1/sessions/${sessionId}/items/${item.index}/complete`)
          .set('Authorization', auth)
      }

      const end = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', auth)
      expect(end.status).toBe(200)
      expect(['completed', 'partial', 'abandoned']).toContain(end.body.data.status)

      const totalAnswered = quizItems.length
      const expectedAccuracy =
        totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 10000) / 10000 : 0

      // RED: endpoint does not exist yet — this assertion fails with 404
      const res = await harness
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}/summary`)
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data.questionsAnswered).toBe(totalAnswered)
      expect(res.body.data.accuracy).toBe(expectedAccuracy)
      expect(Array.isArray(res.body.data.domains)).toBe(true)
      expect(res.body.data.domains.length).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(res.body.data.weakAreaDeltas)).toBe(true)
      expect(res.body.data.readiness).toBeDefined()
      expect(
        typeof res.body.data.readiness.before === 'number' ||
          res.body.data.readiness.before === null,
      ).toBe(true)
      // after/delta are null when not yet calibrated
      expect('strongestQuestion' in res.body.data).toBe(true)
      expect('weakestQuestion' in res.body.data).toBe(true)
      expect('nextFocus' in res.body.data).toBe(true)
    })

    it('returns 409 when the session is still active', async () => {
      const cert = await harness.seedCertification('SUM-ACTIVE-01')
      await harness.seedChunk(cert.id, 'Security')

      const token = await harness.registerAndLogin('sum-active-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', auth)
        .send({ durationMinutes: 30, contentMix: 'balanced', difficulty: 'intermediate' })
      expect(create.status).toBe(201)
      const sessionId = create.body.data.id as string

      // RED: endpoint does not exist yet — this assertion fails with 404 instead of 409
      const res = await harness
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}/summary`)
        .set('Authorization', auth)

      expect(res.status).toBe(409)
    })
  })

  // ---------------------------------------------------------------------------
  // Study session: POST /api/v1/sessions/:id/drill
  // ---------------------------------------------------------------------------

  describe('POST /api/v1/sessions/:id/drill — study path', () => {
    it('starts a targeted review session when the source session has misses or flagged-unsure answers', async () => {
      const cert = await harness.seedCertification('SUM-DRILL-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin('sum-drill-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', auth)
        .send({ durationMinutes: 30, contentMix: 'quiz-heavy', difficulty: 'intermediate' })
      expect(create.status).toBe(201)
      const sessionId = create.body.data.id as string

      const getItems = await harness
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', auth)
      expect(getItems.status).toBe(200)

      const items = getItems.body.data.items as SessionItemPayload[]
      const quizItems = items.filter((i) => i.type === 'quiz')

      // Answer all quiz items incorrectly with low confidence — all are misses
      for (const item of quizItems) {
        const parsed = JSON.parse(item.content) as QuizContent
        const submitRes = await harness
          .getRequest()
          .post(`/api/v1/quiz/${parsed.questionId}/submit`)
          .set('Authorization', auth)
          .send({
            userCertificationId: enrollmentId,
            answer: SESSION_SUMMARY_WRONG_ANSWER,
            confidence: 1,
            timeTakenMs: 1000,
          })
        expect(submitRes.status).toBe(201)
      }

      const end = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', auth)
      expect(end.status).toBe(200)

      // RED: endpoint does not exist yet — this assertion fails with 404
      const drill = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/drill`)
        .set('Authorization', auth)

      expect([200, 201]).toContain(drill.status)
      expect(drill.body.data.status).toBe('started')
      expect(drill.body.data.session).toBeDefined()
      expect(drill.body.data.session.kind).toBe('review')
      expect(drill.body.data.session.status).toBe('active')
    })

    it("returns { status: 'no_misses' } when every answer was correct with high confidence", async () => {
      const cert = await harness.seedCertification('SUM-NODRILL-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin('sum-nodrill-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', auth)
        .send({ durationMinutes: 30, contentMix: 'quiz-heavy', difficulty: 'intermediate' })
      expect(create.status).toBe(201)
      const sessionId = create.body.data.id as string

      const getItems = await harness
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', auth)
      expect(getItems.status).toBe(200)

      const items = getItems.body.data.items as SessionItemPayload[]
      const quizItems = items.filter((i) => i.type === 'quiz')

      // Answer ALL quiz items correctly with high confidence — no misses
      for (const item of quizItems) {
        const parsed = JSON.parse(item.content) as QuizContent
        const submitRes = await harness
          .getRequest()
          .post(`/api/v1/quiz/${parsed.questionId}/submit`)
          .set('Authorization', auth)
          .send({
            userCertificationId: enrollmentId,
            answer: SESSION_SUMMARY_CORRECT_ANSWER,
            confidence: 5,
            timeTakenMs: 1000,
          })
        expect(submitRes.status).toBe(201)
      }

      const end = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', auth)
      expect(end.status).toBe(200)

      // RED: endpoint does not exist yet — this assertion fails with 404
      const drill = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/drill`)
        .set('Authorization', auth)

      expect(drill.status).toBe(200)
      expect(drill.body.data.status).toBe('no_misses')
    })
  })

  // ---------------------------------------------------------------------------
  // Mock exam: GET /api/v1/mock-exams/:id/summary
  // ---------------------------------------------------------------------------

  describe('GET /api/v1/mock-exams/:id/summary — mock path', () => {
    it('returns summary shape for a submitted mock exam with at least one correct and one wrong answer', async () => {
      const cert = await harness.seedCertification('SUM-MOCK-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin('sum-mock-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      const mockId = create.body.data.id as string

      await harness.runGenerationJob(mockId)

      const getExam = await harness
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(getExam.status).toBe(200)
      expect(getExam.body.data.generation).toBe('ready')

      // Answer question 0 correctly; leave the rest unanswered (scored as incorrect)
      await harness
        .getRequest()
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', auth)
        .send({ answer: SESSION_SUMMARY_CORRECT_ANSWER })

      const submit = await harness
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(submit.status).toBe(200)
      expect(submit.body.data.status).toBe('submitted')

      // RED: endpoint does not exist yet — this assertion fails with 404
      const res = await harness
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}/summary`)
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(typeof res.body.data.questionsAnswered).toBe('number')
      expect(typeof res.body.data.accuracy).toBe('number')
      expect(Array.isArray(res.body.data.domains)).toBe(true)
      expect(Array.isArray(res.body.data.weakAreaDeltas)).toBe(true)
      expect(res.body.data.readiness).toBeDefined()
      expect('strongestQuestion' in res.body.data).toBe(true)
      expect('weakestQuestion' in res.body.data).toBe(true)
      expect('nextFocus' in res.body.data).toBe(true)
    })

    it('returns 409 when the mock exam is still in_progress', async () => {
      const cert = await harness.seedCertification('SUM-MOCK-ACTIVE-01')
      await harness.seedChunk(cert.id, 'Security')

      const token = await harness.registerAndLogin('sum-mock-active@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      const mockId = create.body.data.id as string

      // RED: endpoint does not exist yet — this assertion fails with 404 instead of 409
      const res = await harness
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}/summary`)
        .set('Authorization', auth)

      expect(res.status).toBe(409)
    })
  })

  // ---------------------------------------------------------------------------
  // Mock exam: POST /api/v1/mock-exams/:id/drill
  // ---------------------------------------------------------------------------

  describe('POST /api/v1/mock-exams/:id/drill — mock path', () => {
    it('starts a targeted review session for incorrectly answered mock questions', async () => {
      const cert = await harness.seedCertification('SUM-MOCK-DRILL-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin('sum-mock-drill-01@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      const mockId = create.body.data.id as string

      await harness.runGenerationJob(mockId)

      // Submit without answering anything — all questions are wrong/unanswered
      const submit = await harness
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(submit.status).toBe(200)

      // RED: endpoint does not exist yet — this assertion fails with 404
      const drill = await harness
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/drill`)
        .set('Authorization', auth)

      expect([200, 201]).toContain(drill.status)
      expect(drill.body.data.status).toBe('started')
      expect(drill.body.data.session).toBeDefined()
      expect(drill.body.data.session.kind).toBe('review')
    })

    it("returns { status: 'no_misses' } when every mock question was answered correctly", async () => {
      const cert = await harness.seedCertification('SUM-MOCK-NODRILL-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await harness.seedChunk(cert.id, domain)
      }

      const token = await harness.registerAndLogin(
        'sum-mock-nodrill-01@example.com',
        'correcthorse',
      )
      const auth = `Bearer ${token}`
      const enrollmentId = await harness.enroll(token, cert.id)

      const create = await harness
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      const mockId = create.body.data.id as string

      await harness.runGenerationJob(mockId)

      const getExam = await harness
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(getExam.status).toBe(200)
      const questionCount = (getExam.body.data.questions as unknown[]).length

      // Answer ALL questions correctly
      for (let i = 0; i < questionCount; i++) {
        const answerRes = await harness
          .getRequest()
          .put(`/api/v1/mock-exams/${mockId}/answers/${i}`)
          .set('Authorization', auth)
          .send({ answer: SESSION_SUMMARY_CORRECT_ANSWER })
        expect(answerRes.status).toBe(200)
      }

      const submit = await harness
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(submit.status).toBe(200)

      // RED: endpoint does not exist yet — this assertion fails with 404
      const drill = await harness
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/drill`)
        .set('Authorization', auth)

      expect(drill.status).toBe(200)
      expect(drill.body.data.status).toBe('no_misses')
    })
  })
})
