import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  CORRECT_ANSWER,
  createReviewHarness,
  type ReviewHarness,
} from './test/review-acceptance-harness'

const WRONG = 'Option B'

describe('Review (spaced repetition)', () => {
  let h: ReviewHarness
  let token: string
  let userId: string
  let certId: string
  let enrollmentId: string

  beforeAll(async () => {
    h = await createReviewHarness()
  }, 180_000)

  afterAll(async () => {
    await h.teardown()
  })

  beforeEach(async () => {
    await h.resetState()
    token = await h.registerAndLogin(`u${Math.random()}@test.dev`, 'password123')
    userId = await h.getUserIdFromToken(token)
    const cert = await h.seedCertification(`C${Math.floor(Math.random() * 1e6)}`)
    certId = cert.id
    enrollmentId = await h.seedEnrollment(userId, certId)
  })

  const auth = (r: ReturnType<ReviewHarness['getRequest']>) => r

  describe('Accrual on quiz answer', () => {
    it('enqueues a concept on an incorrect answer', async () => {
      await h.seedChunk(certId, 'Security')
      await h.answerQuiz(token, enrollmentId, 'Security', { answer: WRONG, confidence: 5 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(1)
      expect(items[0]!.state).toBe('active')
      expect(items[0]!.box).toBe(1)
    })

    it('enqueues a concept on a correct-but-unsure answer', async () => {
      await h.seedChunk(certId, 'Security')
      await h.answerQuiz(token, enrollmentId, 'Security', { answer: CORRECT_ANSWER, confidence: 2 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(1)
      expect(items[0]!.state).toBe('active')
    })

    it('does not enqueue a confident-correct answer', async () => {
      await h.seedChunk(certId, 'Security')
      await h.answerQuiz(token, enrollmentId, 'Security', { answer: CORRECT_ANSWER, confidence: 4 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(0)
    })

    it('does not duplicate an existing active item and applies the Leitner schedule', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { box: 2, state: 'active', dueInDays: -1 })

      await h.answerQuiz(token, enrollmentId, 'Security', { answer: CORRECT_ANSWER, confidence: 4 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(1)
      expect(items[0]!.box).toBe(3)
    })
  })

  describe('Accrual state-machine edges', () => {
    it('leaves a suppressed concept suppressed when answered again', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { state: 'suppressed', dueInDays: -1 })

      await h.answerQuiz(token, enrollmentId, 'Security', { answer: WRONG, confidence: 5 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(1)
      expect(items[0]!.state).toBe('suppressed')
    })

    it('reactivates a mastered concept on a wrong answer', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { box: 5, state: 'mastered', dueInDays: 30 })

      await h.answerQuiz(token, enrollmentId, 'Security', { answer: WRONG, confidence: 5 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.state).toBe('active')
      expect(items[0]!.box).toBe(1)
    })

    it('leaves a mastered concept mastered on a confident-correct answer', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { box: 5, state: 'mastered', dueInDays: 30 })

      await h.answerQuiz(token, enrollmentId, 'Security', { answer: CORRECT_ANSWER, confidence: 4 })

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.state).toBe('mastered')
    })
  })

  describe('Due-queue read model', () => {
    it('reports due count and lists only active overdue items', async () => {
      const c1 = await h.seedChunk(certId, 'Security')
      const c2 = await h.seedChunk(certId, 'Security')
      const c3 = await h.seedChunk(certId, 'Security')
      const future = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, c1, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, c2, { dueInDays: -2 })
      await h.seedReviewItem(enrollmentId, c3, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, future, { dueInDays: 5 })

      const res = await auth(h.getRequest())
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.meta.dueCount).toBe(3)
      expect(res.body.data).toHaveLength(3)
    })

    it('excludes suppressed and mastered items even when overdue', async () => {
      const a = await h.seedChunk(certId, 'Security')
      const s = await h.seedChunk(certId, 'Security')
      const m = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, a, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, s, { dueInDays: -1, state: 'suppressed' })
      await h.seedReviewItem(enrollmentId, m, { dueInDays: -1, state: 'mastered' })

      const res = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta.dueCount).toBe(1)
    })

    it("returns 404 for another user's enrollment", async () => {
      const otherToken = await h.registerAndLogin(`o${Math.random()}@test.dev`, 'password123')
      const res = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${otherToken}`)
      expect(res.status).toBe(404)
    })
  })

  describe('Standalone five-minute review', () => {
    it('starts a quiz-only review session from due items, capped, with no reading blocks', async () => {
      for (let i = 0; i < 9; i++) {
        const chunkId = await h.seedChunk(certId, 'Security')
        await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })
      }

      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('started')
      const sessionId = res.body.data.session.id
      expect(res.body.data.session.kind).toBe('review')

      const detail = await h
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', `Bearer ${token}`)
      const items = detail.body.data.items as { type: string }[]
      expect(items.length).toBeGreaterThanOrEqual(1)
      expect(items.length).toBeLessThanOrEqual(7)
      expect(items.every((i) => i.type === 'quiz')).toBe(true)
    })

    it('closes the loop: answering a due item promotes it and drops it from the queue', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { box: 1, dueInDays: -1 })

      const start = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)
      const sessionId = start.body.data.session.id

      const detail = await h
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', `Bearer ${token}`)
      const quizItem = (detail.body.data.items as { type: string; content: string }[]).find(
        (i) => i.type === 'quiz',
      )
      const questionId = JSON.parse(quizItem!.content).questionId as string

      await h
        .getRequest()
        .post(`/api/v1/quiz/${questionId}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          answer: CORRECT_ANSWER,
          confidence: 5,
          timeTakenMs: 1000,
        })

      const items = await h.listReviewItems(enrollmentId)
      expect(items).toHaveLength(1)
      expect(items[0]!.box).toBe(2)

      const queue = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(queue.body.meta.dueCount).toBe(0)
    })

    it('returns the all-caught-up state when nothing is due', async () => {
      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('all_caught_up')

      const list = await h
        .getRequest()
        .get('/api/v1/sessions')
        .set('Authorization', `Bearer ${token}`)
      expect(list.body.data).toHaveLength(0)
    })

    it('resumes an existing active session instead of starting a second', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })

      const study = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ learningStyle: 'weak-area-focus' })
      const studyId = study.body.data.id

      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.body.data.status).toBe('started')
      expect(res.body.data.session.id).toBe(studyId)

      const list = await h
        .getRequest()
        .get('/api/v1/sessions?status=active')
        .set('Authorization', `Bearer ${token}`)
      expect(list.body.data).toHaveLength(1)
    })
  })

  describe('Mark-as-mastered and suppress', () => {
    it('suppresses a single concept and removes it from the queue', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/master`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.state).toBe('suppressed')

      const queue = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(queue.body.data).toHaveLength(0)
    })

    it('suppresses an entire domain by anchor primary domain', async () => {
      const sec1 = await h.seedChunk(certId, 'Security')
      const sec2 = await h.seedChunk(certId, 'Security')
      const net = await h.seedChunk(certId, 'Networking')
      await h.seedReviewItem(enrollmentId, sec1, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, sec2, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, net, { dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/suppress-domain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ domain: 'Security' })
      expect(res.status).toBe(200)
      expect(res.body.data.suppressedCount).toBe(2)

      const items = await h.listReviewItems(enrollmentId)
      const byState = items.filter((i) => i.state === 'suppressed')
      expect(byState).toHaveLength(2)
    })

    it('surfaces a fully-suppressed domain in the queue meta so the frontend can derive mastered state from fetched data (fix-web-learner-surfaces-parity 6.1)', async () => {
      const sec1 = await h.seedChunk(certId, 'Security')
      const sec2 = await h.seedChunk(certId, 'Security')
      const net = await h.seedChunk(certId, 'Networking')
      await h.seedReviewItem(enrollmentId, sec1, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, sec2, { dueInDays: -1 })
      await h.seedReviewItem(enrollmentId, net, { dueInDays: -1 })

      // Before suppressing, the queue meta lists no suppressed domains at all.
      const before = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(before.body.meta.suppressedDomains).toEqual([])

      await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/suppress-domain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ domain: 'Security' })

      const after = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(after.body.meta.suppressedDomains).toEqual(['Security'])
    })

    it('does not report a domain as suppressed when it has no review items at all', async () => {
      // Regression guard: a domain that was never reviewed must not vacuously satisfy "every
      // review item in this domain is suppressed" (there are zero items, not zero non-suppressed
      // ones) — that would falsely mark every never-studied domain as mastered.
      await h.seedChunk(certId, 'Networking')

      const res = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.body.meta.suppressedDomains).toEqual([])
    })

    it('rejects a suppress-domain request with an empty domain', async () => {
      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/suppress-domain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ domain: '' })
      expect(res.status).toBe(422)
    })

    it("returns 404 when suppressing another user's item", async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })
      const otherToken = await h.registerAndLogin(`x${Math.random()}@test.dev`, 'password123')

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/master`)
        .set('Authorization', `Bearer ${otherToken}`)
      expect(res.status).toBe(404)
    })
  })

  describe('Re-anchoring on chunk supersession', () => {
    it('re-anchors via supersededById lineage', async () => {
      const newChunk = await h.seedChunk(certId, 'Security')
      const oldChunk = await h.seedChunk(certId, 'Security')
      await h.supersedeChunk(oldChunk, newChunk)
      await h.seedReviewItem(enrollmentId, oldChunk, { dueInDays: -1 })

      await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.anchor_chunk_id).toBe(newChunk)
    })

    it('retrieves a replacement chunk when no lineage exists', async () => {
      const replacement = await h.seedChunk(certId, 'Security')
      const oldChunk = await h.seedChunk(certId, 'Security')
      await h.supersedeChunk(oldChunk, null)
      await h.seedReviewItem(enrollmentId, oldChunk, { dueInDays: -1 })

      await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.anchor_chunk_id).toBe(replacement)
    })

    it('holds the item (does not delete) when nothing clears the threshold', async () => {
      const oldChunk = await h.seedChunk(certId, 'Security')
      await h.supersedeChunk(oldChunk, null)
      const itemId = await h.seedReviewItem(enrollmentId, oldChunk, { dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/review/start`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.body.data.status).toBe('all_caught_up')

      const items = await h.listReviewItems(enrollmentId)
      expect(items.map((i) => i.id)).toContain(itemId)
    })
  })

  describe('Session planner front-loading', () => {
    it('front-loads due review items at the start of a spaced-repetition session', async () => {
      for (let i = 0; i < 4; i++) {
        const chunkId = await h.seedChunk(certId, 'Security')
        await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })
      }

      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ learningStyle: 'spaced-repetition', contentMix: 'balanced' })
      const sessionId = create.body.data.id

      const detail = await h
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', `Bearer ${token}`)
      const items = detail.body.data.items as { index: number; type: string }[]
      expect(items.slice(0, 3).every((i) => i.type === 'quiz')).toBe(true)
    })

    it('proceeds with new material when nothing is due', async () => {
      await h.seedChunk(certId, 'Security')

      const create = await h
        .getRequest()
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ learningStyle: 'spaced-repetition', contentMix: 'balanced' })
      const sessionId = create.body.data.id

      const detail = await h
        .getRequest()
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', `Bearer ${token}`)
      const items = detail.body.data.items as { index: number; type: string }[]
      expect(items[0]!.type).toBe('reading')
    })
  })
})
