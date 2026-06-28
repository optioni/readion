import { UserCertification } from '@readion/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPassRateHarness, type PassRateHarness } from './test/analytics-pass-rate-harness'

// Integration coverage for the lagging self-reported real-exam outcome breakdown against a seeded
// Postgres population. Enrollments carry a mix of recorded `exam_outcome_response` values; the
// breakdown tallies them into all four keys (zero-filling any unseen outcome). With no recorded
// outcomes the breakdown reports zeros rather than failing, and recording an outcome never alters
// the readiness score (this metric is display-only and feeds nothing else).
describe('AnalyticsService lagging pass-rate breakdown (integration)', () => {
  let harness: PassRateHarness

  beforeAll(async () => {
    harness = await createPassRateHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('tallies recorded exam outcomes into all four keys, zero-filling unseen outcomes', async () => {
    const breakdown = await harness.service.getPassRateBreakdown()
    expect(breakdown).toEqual(harness.expectations.breakdown)
  })

  it('recording an exam outcome does not alter the readiness score', async () => {
    const enrollmentId = harness.expectations.calibratedEnrollmentId
    const before = await harness.readiness.compute(enrollmentId)

    const fork = harness.em.fork()
    const enrollment = await fork.findOneOrFail(UserCertification, { id: enrollmentId })
    enrollment.examOutcomeResponse = 'passed'
    enrollment.examOutcomeRespondedAt = new Date()
    await fork.flush()

    const after = await harness.readiness.compute(enrollmentId)
    expect(after).toEqual(before)
  })

  it('reports all-zeros and does not throw when no outcomes are recorded', async () => {
    const fork = harness.em.fork()
    await fork.nativeUpdate(UserCertification, {}, { examOutcomeResponse: null })

    const breakdown = await harness.service.getPassRateBreakdown()
    expect(breakdown).toEqual({ passed: 0, did_not_pass: 0, not_yet: 0, dismissed: 0 })
  })
})
