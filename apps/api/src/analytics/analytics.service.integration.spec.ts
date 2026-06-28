import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createSessionMetricsHarness,
  type SessionMetricsHarness,
} from './test/analytics-session-metrics-harness'

// Integration coverage for the active-user population and session-derived metrics against a
// seeded Postgres population. Abandoned sessions never count toward the active set or the
// completion numerator, and agent-linked conversations without a role:user message are
// excluded from engagement.
describe('AnalyticsService session metrics (integration)', () => {
  let harness: SessionMetricsHarness

  beforeAll(async () => {
    harness = await createSessionMetricsHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('counts only users with enough completed sessions ended inside the window', async () => {
    const population = await harness.service.getActiveUserPopulation()
    expect(population.count).toBe(harness.expectations.activeUsers)
    expect(population.userIds).toHaveLength(harness.expectations.activeUsers)
  })

  it('computes completion rate as reached-summary over sessions started in the window', async () => {
    const rate = await harness.service.getCompletionRate()
    expect(rate).toBeCloseTo(harness.expectations.completionRate)
  })

  it('computes agent engagement, excluding conversations with no user message', async () => {
    const engagement = await harness.service.getAgentEngagementRate()
    expect(engagement).toBeCloseTo(harness.expectations.agentEngagement)
  })

  it('computes the median completed-sessions-per-week across active users', async () => {
    const perWeek = await harness.service.getSessionsPerWeek()
    expect(perWeek).toBeCloseTo(harness.expectations.sessionsPerWeek)
  })
})
