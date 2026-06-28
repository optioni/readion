import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createRetentionHarness,
  RETENTION_NOW,
  type RetentionHarness,
} from './test/analytics-retention-harness'

// Integration coverage for registration-week retention cohorts against a seeded Postgres
// population. Users are grouped by the calendar week of User.createdAt; the active-user predicate
// is evaluated as of each user's week-2 (registration + 14d) and week-4 (registration + 28d)
// boundary. A known active subset in each week yields the expected per-cohort fractions and sizes.
describe('AnalyticsService retention cohorts (integration)', () => {
  let harness: RetentionHarness

  beforeAll(async () => {
    harness = await createRetentionHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('reports per-cohort W2 retention with cohort size', async () => {
    const result = await harness.service.getRetentionCohorts(RETENTION_NOW)
    expect(result.w2.cohorts).toEqual(harness.expectations.w2Cohorts)
  })

  it('reports per-cohort W4 retention with cohort size', async () => {
    const result = await harness.service.getRetentionCohorts(RETENTION_NOW)
    expect(result.w4.cohorts).toEqual(harness.expectations.w4Cohorts)
  })

  it('pools the overall W2 and W4 fractions and populations across cohorts', async () => {
    const result = await harness.service.getRetentionCohorts(RETENTION_NOW)
    expect(result.w2.population).toBe(harness.expectations.w2Population)
    expect(result.w2.value).toBeCloseTo(harness.expectations.w2Value)
    expect(result.w4.population).toBe(harness.expectations.w4Population)
    expect(result.w4.value).toBeCloseTo(harness.expectations.w4Value)
  })
})
