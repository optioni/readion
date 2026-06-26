import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createDiagnosticAcceptanceHarness,
  DIAGNOSTIC_CORRECT_ANSWER,
  type DiagnosticAcceptanceHarness,
} from './test/diagnostic-acceptance-harness'

describe('Diagnostic acceptance', () => {
  let h: DiagnosticAcceptanceHarness

  beforeAll(async () => {
    h = await createDiagnosticAcceptanceHarness()
  }, 180_000)

  afterAll(async () => {
    await h?.teardown()
  })

  beforeEach(async () => {
    await h.resetState()
  })

  describe('Full diagnostic lifecycle: offer → create → generate → answer → submit → readiness', () => {
    it('completes a diagnostic end-to-end and calibrates readiness', async () => {
      // Seed a live certification with enough chunks per domain so generation can
      // fill the full breadth budget (DIAGNOSTIC_QUESTION_COUNT = 12, 50/50 split →
      // 6 Security + 6 Networking). Seed 8 per domain to avoid chunk exhaustion.
      const cert = await h.seedCertification('DIAG-E2E-01')
      for (let i = 0; i < 8; i++) {
        await h.seedChunk(cert.id, 'Security')
      }
      for (let i = 0; i < 8; i++) {
        await h.seedChunk(cert.id, 'Networking')
      }

      const token = await h.registerAndLogin('diag-e2e@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await h.enroll(token, cert.id)

      // Fresh uncalibrated enrollment is offered the diagnostic at onboarding.
      const offerRes = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', auth)
      expect(offerRes.status).toBe(200)
      expect(offerRes.body.data.offer).toBe('onboarding')

      // Creating a diagnostic returns 201 with a MockExam of type "diagnostic",
      // status "in_progress", deadline null, questions empty.
      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/diagnostic`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)
      expect(create.body.data.type).toBe('diagnostic')
      expect(create.body.data.status).toBe('in_progress')
      expect(create.body.data.deadline).toBeNull()
      expect(create.body.data.questions).toHaveLength(0)

      const diagnosticId = create.body.data.id as string
      expect(diagnosticId).toBeDefined()

      // Before generation the attempt is in "preparing" state.
      const beforeGen = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${diagnosticId}`)
        .set('Authorization', auth)
      expect(beforeGen.status).toBe(200)
      expect(beforeGen.body.data.generation).toBe('preparing')
      expect(beforeGen.body.data.deadline).toBeNull()

      // Drive generation deterministically. For a diagnostic:
      // - every domain is probed (breadth set)
      // - startedAt is stamped after generation
      // - deadline stays null
      await h.runGenerationJob(diagnosticId)

      const afterGen = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${diagnosticId}`)
        .set('Authorization', auth)
      expect(afterGen.status).toBe(200)
      expect(afterGen.body.data.generation).toBe('ready')
      expect(afterGen.body.data.deadline).toBeNull()
      expect(afterGen.body.data.remainingSeconds).toBeNull()
      // Questions cover both domains
      const generatedQuestions = afterGen.body.data.questions as Array<{ domain: string }>
      const domains = new Set(generatedQuestions.map((q) => q.domain))
      expect(domains.has('Security')).toBe(true)
      expect(domains.has('Networking')).toBe(true)

      // Answer question 0 correctly; leave all other questions unanswered (→ incorrect).
      const answerRes = await h
        .getRequest()
        .put(`/api/v1/mock-exams/${diagnosticId}/answers/0`)
        .set('Authorization', auth)
        .send({ answer: DIAGNOSTIC_CORRECT_ANSWER })
      expect(answerRes.status).toBe(200)

      // Submit: should return 200 with score, domainBreakdown, and passed = null
      // (no pass/fail verdict for diagnostics).
      const submit = await h
        .getRequest()
        .post(`/api/v1/mock-exams/${diagnosticId}/submit`)
        .set('Authorization', auth)
      expect(submit.status).toBe(200)
      expect(submit.body.data.status).toBe('submitted')
      expect(submit.body.data.score).toBeGreaterThanOrEqual(0)
      expect(submit.body.data.score).toBeLessThanOrEqual(1)
      expect(submit.body.data.passed).toBeNull()
      expect(submit.body.data.domainBreakdown).toBeDefined()
      expect(typeof submit.body.data.domainBreakdown).toBe('object')

      // GET /mock-exams/:id for a submitted diagnostic: score and domainBreakdown
      // present, passed null.
      const review = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${diagnosticId}`)
        .set('Authorization', auth)
      expect(review.status).toBe(200)
      expect(review.body.data.status).toBe('submitted')
      expect(review.body.data.score).toBeGreaterThanOrEqual(0)
      expect(review.body.data.passed).toBeNull()
      expect(review.body.data.domainBreakdown).toBeDefined()

      // On submit: one QuizResponse per question emitted (unanswered = incorrect).
      const quizResponseCount = await h.countQuizResponses(enrollmentId)
      expect(quizResponseCount).toBe(generatedQuestions.length)

      // On submit: a WeakArea row per probed domain after recompute.
      const weakAreaCount = await h.countWeakAreas(enrollmentId)
      expect(weakAreaCount).toBeGreaterThanOrEqual(2) // at least Security + Networking

      // Diagnostic misses seed the review queue: ≥1 incorrect answer →
      // spaced-repetition accrual creates a ReviewItem.
      const reviewItemCount = await h.countReviewItems(enrollmentId)
      expect(reviewItemCount).toBeGreaterThanOrEqual(1)

      // After submit, readiness flips to calibrated=true with a numeric score.
      const readiness = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
        .set('Authorization', auth)
      expect(readiness.status).toBe(200)
      expect(readiness.body.data.calibrated).toBe(true)
      expect(typeof readiness.body.data.score).toBe('number')
    })
  })

  describe('Abandoned diagnostic is ignored by the auto-submit cron', () => {
    it('leaves an in_progress diagnostic with null deadline untouched by the cron', async () => {
      const cert = await h.seedCertification('DIAG-ABANDON-01')
      for (let i = 0; i < 8; i++) {
        await h.seedChunk(cert.id, 'Security')
      }
      for (let i = 0; i < 8; i++) {
        await h.seedChunk(cert.id, 'Networking')
      }

      const token = await h.registerAndLogin('diag-abandon@example.com', 'correcthorse')
      const auth = `Bearer ${token}`
      const enrollmentId = await h.enroll(token, cert.id)

      // Create a diagnostic and abandon it (never submit).
      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/diagnostic`)
        .set('Authorization', auth)
      expect(create.status).toBe(201)

      const diagnosticId = create.body.data.id as string

      // Run the mock auto-submit cron well in the future.
      // Because deadline is null, the cron's `deadline: { $lt: cutoff }` query
      // never matches this attempt.
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await h.runAutoSubmitCron(farFuture)

      // Status should still be in_progress.
      const afterCron = await h
        .getRequest()
        .get(`/api/v1/mock-exams/${diagnosticId}`)
        .set('Authorization', auth)
      expect(afterCron.status).toBe(200)
      expect(afterCron.body.data.status).toBe('in_progress')

      // No QuizResponse emitted, nothing seeded.
      const quizResponseCount = await h.countQuizResponses(enrollmentId)
      expect(quizResponseCount).toBe(0)

      const reviewItemCount = await h.countReviewItems(enrollmentId)
      expect(reviewItemCount).toBe(0)
    })
  })
})
