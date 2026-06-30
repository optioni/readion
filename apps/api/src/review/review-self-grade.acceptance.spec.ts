// Endpoint decision (task 0.0):
// NEW action POST /api/v1/review-items/:id/grade with body { grade: 'again'|'hard'|'good'|'easy' }
// on the existing ReviewItemsController alongside POST :id/master.
// There is NO existing "review-answer" action; quiz + confidence accrual runs via
// POST /api/v1/quiz/:id/submit + QUIZ_ANSWERED_EVENT listener.
//
// Leitner intervals (1-indexed box n, 0-indexed array): [1, 3, 7, 16, 35]
// again → box 1, dueAt = intervals[0] = 1d
// hard  → keep box n, dueAt = intervals[n-1]
// good  → box n+1 (or mastered if n=5), dueAt = intervals[n] (when not mastered)
// easy  → box n+2 (or mastered if n+2>5), dueAt = intervals[n+1] (when not mastered)
// lastReviewedAt set to now on EVERY grade.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createReviewHarness,
  type ReviewHarness,
} from './test/review-acceptance-harness'

const LEITNER_INTERVALS = [1, 3, 7, 16, 35] as const
const DAY_MS = 24 * 60 * 60 * 1000
const TOLERANCE_HOURS = 2

function assertDueAtWithinDays(dueAt: string, expectedDays: number): void {
  const actual = new Date(dueAt).getTime()
  const now = Date.now()
  const expected = now + expectedDays * DAY_MS
  const toleranceMs = (TOLERANCE_HOURS / 24) * DAY_MS
  expect(actual).toBeGreaterThanOrEqual(expected - toleranceMs)
  expect(actual).toBeLessThanOrEqual(expected + toleranceMs)
}

describe('Self-grade (spaced repetition)', () => {
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

  describe('Grade → box/state transitions', () => {
    it('good on box 2 → box 3, dueAt ≈ now + 7 days, lastReviewedAt set', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { box: 2, dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(200)
      expect(res.body.data.box).toBe(3)
      assertDueAtWithinDays(res.body.data.dueAt, LEITNER_INTERVALS[2])
      expect(res.body.data.lastReviewedAt).not.toBeNull()

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(3)
      expect(items[0]!.state).toBe('active')
    })

    it('again on box 4 → box 1, dueAt ≈ now + 1 day', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { box: 4, dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'again' })

      expect(res.status).toBe(200)
      expect(res.body.data.box).toBe(1)
      assertDueAtWithinDays(res.body.data.dueAt, LEITNER_INTERVALS[0])

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(1)
      expect(items[0]!.state).toBe('active')
    })

    it('hard on box 3 → stays box 3, dueAt ≈ now + 7 days', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { box: 3, dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'hard' })

      expect(res.status).toBe(200)
      expect(res.body.data.box).toBe(3)
      assertDueAtWithinDays(res.body.data.dueAt, LEITNER_INTERVALS[2])

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(3)
      expect(items[0]!.state).toBe('active')
    })

    it('good on top box (5) → state mastered, leaves due queue', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { box: 5, dueInDays: -1 })

      const queueBefore = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(queueBefore.body.meta.dueCount).toBe(1)

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(200)
      expect(res.body.data.state).toBe('mastered')

      const queueAfter = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(queueAfter.body.meta.dueCount).toBe(0)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.state).toBe('mastered')
    })

    it('easy on top box (5) → state mastered, leaves due queue', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { box: 5, dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'easy' })

      expect(res.status).toBe(200)
      expect(res.body.data.state).toBe('mastered')

      const queueAfter = await h
        .getRequest()
        .get(`/api/v1/user-certifications/${enrollmentId}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(queueAfter.body.meta.dueCount).toBe(0)
    })
  })

  describe('Guard rejections', () => {
    it('returns 404 when grading a not-owned item, no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })
      const otherToken = await h.registerAndLogin(`o${Math.random()}@test.dev`, 'password123')

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(404)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(1)
      expect(items[0]!.state).toBe('active')
    })

    it('returns 409 when grading a not-due item (dueAt in the future), no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: 5 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(409)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(1)
      expect(items[0]!.state).toBe('active')
    })

    it('returns 409 when grading a mastered item, no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, {
        box: 5,
        state: 'mastered',
        dueInDays: 30,
      })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(409)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(5)
      expect(items[0]!.state).toBe('mastered')
    })

    it('returns 409 when grading a suppressed item, no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, {
        state: 'suppressed',
        dueInDays: -1,
      })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'good' })

      expect(res.status).toBe(409)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.state).toBe('suppressed')
    })
  })

  describe('Validation', () => {
    it('returns 422 with errors[] entry for grade on an invalid grade value, no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'sometimes' })

      expect(res.status).toBe(422)
      expect(Array.isArray(res.body.errors)).toBe(true)
      expect((res.body.errors as { field: string }[]).some((e) => e.field === 'grade')).toBe(true)

      const items = await h.listReviewItems(enrollmentId)
      expect(items[0]!.box).toBe(1)
      expect(items[0]!.state).toBe('active')
    })

    it('returns 422 with errors[] entry for grade when grade field is missing, no schedule change', async () => {
      const chunkId = await h.seedChunk(certId, 'Security')
      const itemId = await h.seedReviewItem(enrollmentId, chunkId, { dueInDays: -1 })

      const res = await h
        .getRequest()
        .post(`/api/v1/review-items/${itemId}/grade`)
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(res.status).toBe(422)
      expect(Array.isArray(res.body.errors)).toBe(true)
      expect((res.body.errors as { field: string }[]).some((e) => e.field === 'grade')).toBe(true)
    })
  })
})
