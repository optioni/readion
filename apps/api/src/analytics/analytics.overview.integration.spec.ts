import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type AnalyticsAcceptanceHarness,
  createAnalyticsAcceptanceHarness,
} from './test/analytics-acceptance-harness'

// Focused integration test (7.1) for the admin analytics overview endpoint: the admin gate
// rejects anonymous (401) and non-admin (403) callers, while an admin receives a 200 with
// every metric section present and each targeted section exposing a numeric target.

const OVERVIEW_ENDPOINT = '/api/v1/admin/analytics/overview'

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

const SECTIONS_WITH_TARGET = [
  'readinessGain',
  'sessionsPerWeek',
  'retentionW2',
  'retentionW4',
  'completionRate',
  'agentEngagement',
  'llmCostPerActiveUser',
] as const

describe('GET /api/v1/admin/analytics/overview', () => {
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

  it('returns every metric section with its target for an admin', async () => {
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

    expect(data.activeUsers?.value).toBe(harness.population.expectedActiveUsers)
  })
})
