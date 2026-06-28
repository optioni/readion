import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createNorthstarHarness, type NorthstarHarness } from './test/analytics-northstar-harness'

// Integration coverage for the north-star readiness gain against a seeded Postgres population.
// The as-of readiness at the 28-day window start is recomputed from the immutable timestamped
// quiz responses. A user who improved across the window contributes the expected per-user gain;
// a user uncalibrated at the window start is excluded from the median rather than counted as a
// zero gain.
describe('AnalyticsService north-star readiness gain (integration)', () => {
  let harness: NorthstarHarness

  beforeAll(async () => {
    harness = await createNorthstarHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('medians the gain of the improved enrollment, excluding the user uncalibrated at the window start', async () => {
    const gain = await harness.service.getReadinessGain()
    expect(gain).toBeCloseTo(harness.expectations.readinessGain, 0)
  })
})
