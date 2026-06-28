import { getToken } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ANALYTICS_ACTIVE_USERS_GAUGE } from './analytics.metrics'
import { AnalyticsService } from './analytics.service'
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

  it('records the active-user count in a Prometheus gauge when the overview is computed', async () => {
    const service = harness.moduleRef.get(AnalyticsService)
    await service.getOverview()

    const gauge = harness.moduleRef.get<Gauge<string>>(getToken(ANALYTICS_ACTIVE_USERS_GAUGE))
    const metric = await gauge.get()
    const sample = metric.values.find((v) => v.labels && Object.keys(v.labels).length === 0)

    expect(sample?.value).toBe(harness.population.expectedActiveUsers)
  })
})
