import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type AnalyticsAcceptanceHarness,
  createAnalyticsAcceptanceHarness,
} from './test/analytics-acceptance-harness'

// Outer-loop acceptance test for the product-analytics change: an admin retrieves the
// analytics overview and every metric section is present, carries its configured target
// where one exists, and reflects the seeded population. Non-admins are forbidden and
// anonymous callers are unauthenticated.

const OVERVIEW_ENDPOINT = '/api/v1/admin/analytics/overview'

// Stable metric-section keys the GREEN groups must conform to. Each section is an object
// pairing a computed figure with its configured target (where a target exists).
const SECTION_KEYS = [
  'activeUsers',
  'readinessGain',
  'sessionsPerWeek',
  'retentionW2',
  'retentionW4',
  'completionRate',
  'agentEngagement',
  'llmCostPerActiveUser',
  'passRateBreakdown',
] as const

// Sections that ship with a configured target to grade the figure against.
const SECTIONS_WITH_TARGET = [
  'readinessGain',
  'sessionsPerWeek',
  'retentionW2',
  'retentionW4',
  'completionRate',
  'agentEngagement',
  'llmCostPerActiveUser',
] as const

describe('product-analytics acceptance', () => {
  let harness: AnalyticsAcceptanceHarness

  beforeAll(async () => {
    harness = await createAnalyticsAcceptanceHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  const req = () => harness.getRequest()

  it('rejects an anonymous caller with 401', async () => {
    const res = await req().get(OVERVIEW_ENDPOINT)
    expect(res.status).toBe(401)
  })

  it('rejects a non-admin caller with 403', async () => {
    const res = await req()
      .get(OVERVIEW_ENDPOINT)
      .set('Authorization', `Bearer ${harness.userToken}`)
    expect(res.status).toBe(403)
  })

  it('returns every metric section with its target, reflecting the seeded population, for an admin', async () => {
    const res = await req()
      .get(OVERVIEW_ENDPOINT)
      .set('Authorization', `Bearer ${harness.adminToken}`)

    expect(res.status).toBe(200)

    const data = res.body.data as Record<string, { value: unknown; target?: unknown }>
    expect(data).toBeDefined()

    for (const key of SECTION_KEYS) {
      expect(data[key], `missing analytics section "${key}"`).toBeDefined()
    }

    for (const key of SECTIONS_WITH_TARGET) {
      expect(typeof data[key]?.target, `section "${key}" must expose a numeric target`).toBe(
        'number',
      )
    }

    // The figures must reflect the seeded population, not be hard-coded stubs.
    expect(data.activeUsers?.value).toBe(harness.population.expectedActiveUsers)

    const completionRate = data.completionRate?.value as number
    expect(completionRate).toBeGreaterThan(0)
    expect(completionRate).toBeLessThanOrEqual(1)

    // North-star readiness gain is genuinely exercised end-to-end: the first active user is
    // calibrated at the 28-day window start and improves across it, yielding a positive median.
    expect(data.readinessGain?.value as number).toBeGreaterThan(0)

    // The lagging pass-rate breakdown reflects the seeded exam-outcome responses.
    expect(data.passRateBreakdown?.value).toBeDefined()
  })
})
