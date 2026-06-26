import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createMockExamAcceptanceHarness,
  MOCK_EXAM_CORRECT_ANSWER,
  type MockExamAcceptanceHarness,
} from './test/mock-exam-acceptance-harness'

describe('MockExam acceptance', () => {
  let h: MockExamAcceptanceHarness

  beforeAll(async () => {
    h = await createMockExamAcceptanceHarness()
  }, 180_000)

  afterAll(async () => {
    await h?.teardown()
  })

  beforeEach(async () => {
    await h.resetState()
  })

  describe('Creating a mock enqueues generation → Deadline starts only when the full set is ready → Submitting scores the attempt → Reviewing a submitted attempt', () => {
    it('full mock-exam lifecycle: create → generate → answer → submit → review', async () => {
      const cert = await h.seedCertification('MOCK-CLF-C02')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await h.seedChunk(cert.id, domain)
      }

      const token = await h.registerAndLogin('mock-exam@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await h.enroll(token, cert.id)

      // Creating a mock enqueues generation and returns immediately
      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      expect(create.body.data.status).toBe('in_progress')
      expect(create.body.data.type).toBe('mock')
      expect(create.body.data.deadline).toBeNull()
      expect(create.body.data.questions).toHaveLength(0)

      const mockId = create.body.data.id as string
      expect(mockId).toBeDefined()

      // Verify generation has been enqueued (GET shows "preparing" state, no deadline yet)
      const beforeGen = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(beforeGen.status).toBe(200)
      expect(beforeGen.body.data.generation).toBe('preparing')
      expect(beforeGen.body.data.deadline).toBeNull()

      // Drive generation job deterministically (fills questions, stamps deadline)
      await h.runGenerationJob(mockId)

      // Deadline starts only when the full set is ready
      const afterGen = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(afterGen.status).toBe(200)
      expect(afterGen.body.data.generation).toBe('ready')
      expect(afterGen.body.data.deadline).not.toBeNull()
      expect(afterGen.body.data.remainingSeconds).toBeGreaterThan(0)
      expect(afterGen.body.data.questions).toHaveLength(cert.questionCount)

      // Answer question 0 correctly (leave questions 1, 2, 3 unanswered → scored as incorrect)
      const answerCorrect = await h
        .getRequest()
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', auth)
        .send({ answer: MOCK_EXAM_CORRECT_ANSWER })
      expect(answerCorrect.status).toBe(200)

      // Overwriting an answer is idempotent (upsert)
      const answerOverwrite = await h
        .getRequest()
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', auth)
        .send({ answer: MOCK_EXAM_CORRECT_ANSWER })
      expect(answerOverwrite.status).toBe(200)

      // Submitting scores the attempt: 1 correct, 3 unanswered=incorrect → score < 700 → failed
      const submit = await h
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(submit.status).toBe(200)
      expect(submit.body.data.status).toBe('submitted')
      // score is a 0..1 fraction (correct / total)
      expect(submit.body.data.score).toBeGreaterThanOrEqual(0)
      expect(submit.body.data.score).toBeLessThanOrEqual(1)
      expect(submit.body.data.passed).toBe(false)
      // domainBreakdown is a Record<domain, {correct, total, accuracy}> object (not an array)
      expect(submit.body.data.domainBreakdown).toBeDefined()
      expect(typeof submit.body.data.domainBreakdown).toBe('object')

      // Submitting again is a conflict
      const resubmit = await h
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(resubmit.status).toBe(409)

      // Reviewing a submitted attempt: questions include correct answer, user answer, citations
      const review = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(review.status).toBe(200)
      expect(review.body.data.status).toBe('submitted')

      const questions = review.body.data.questions as Array<{
        correctAnswer: string
        userAnswer: string | null
        explanation: string
        citations: unknown[]
      }>
      expect(questions).toHaveLength(cert.questionCount)
      expect(questions[0]!.correctAnswer).toBeDefined()
      expect(questions[0]!.userAnswer).toBe(MOCK_EXAM_CORRECT_ANSWER)
      expect(questions[0]!.explanation).toBeDefined()
      expect(questions[0]!.citations).toBeDefined()
      // Unanswered questions appear as null
      expect(questions[1]!.userAnswer).toBeNull()
    })
  })

  describe('Past-deadline attempt is expired and scored', () => {
    it('auto-submit cron expires and scores an in_progress attempt past its deadline', async () => {
      const cert = await h.seedCertification('MOCK-EXP-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await h.seedChunk(cert.id, domain)
      }

      const token = await h.registerAndLogin('mock-expire@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await h.enroll(token, cert.id)

      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)

      const mockId = create.body.data.id as string

      // Drive generation job to stamp deadline
      await h.runGenerationJob(mockId)

      // Verify deadline has been set
      const afterGen = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(afterGen.status).toBe(200)
      expect(afterGen.body.data.deadline).not.toBeNull()

      // Answer one question then let time run out (no submit)
      await h
        .getRequest()
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', auth)
        .send({ answer: MOCK_EXAM_CORRECT_ANSWER })

      // Simulate the cron running well past the deadline + grace window
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await h.runAutoSubmitCron(farFuture)

      // Attempt should now be expired and scored
      const afterExpiry = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', auth)
      expect(afterExpiry.status).toBe(200)
      expect(afterExpiry.body.data.status).toBe('expired')
      expect(afterExpiry.body.data.score).toBeGreaterThanOrEqual(0)
      expect(afterExpiry.body.data.passed).toBeDefined()
      expect(afterExpiry.body.data.domainBreakdown).toBeDefined()

      // Expired attempt rejects further answers
      const lateAnswer = await h
        .getRequest()
        .put(`/api/v1/mock-exams/${mockId}/answers/1`)
        .set('Authorization', auth)
        .send({ answer: 'Option B' })
      expect(lateAnswer.status).toBe(409)

      // Expired attempt rejects manual submit
      const lateSubmit = await h
        .getRequest()
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', auth)
      expect(lateSubmit.status).toBe(409)
    })
  })

  describe('Cross-user access scoping', () => {
    it("creating a mock for another user's enrollment returns 404", async () => {
      const cert = await h.seedCertification('MOCK-XUSER-01')

      const owner = await h.registerAndLogin('mock-owner@example.com', 'correcthorse')
      const enrollmentId = await h.enroll(owner, cert.id)

      const other = await h.registerAndLogin('mock-other@example.com', 'correcthorse')
      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', `Bearer ${other}`)
      expect(res.status).toBe(404)
    })

    it("fetching another user's mock exam returns 404", async () => {
      const cert = await h.seedCertification('MOCK-XUSER-02')
      await h.seedChunk(cert.id, 'Security')

      const owner = await h.registerAndLogin('mock-own2@example.com', 'correcthorse')
      const auth = `Bearer ${owner}`
      const enrollmentId = await h.enroll(owner, cert.id)

      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      const mockId = create.body.data.id as string

      const other = await h.registerAndLogin('mock-oth2@example.com', 'correcthorse')
      const res = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${other}`)
      expect(res.status).toBe(404)
    })
  })

  describe('Listing mock exams for an enrollment', () => {
    it('returns only the owner attempts for that enrollment', async () => {
      const cert = await h.seedCertification('MOCK-LIST-01')

      const token = await h.registerAndLogin('mock-list@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await h.enroll(token, cert.id)

      await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)

      const list = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', auth)
      expect(list.status).toBe(200)
      expect(Array.isArray(list.body.data)).toBe(true)
      expect(list.body.meta).toBeDefined()
      expect(list.body.data).toHaveLength(1)
    })
  })
})
