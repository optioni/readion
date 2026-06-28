import { describe, expect, it } from 'vitest'
import { examOutcomeResponses } from '../lifecycle-email'
import {
  ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT,
  ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT,
  ANALYTICS_METRIC_TARGET_ENV_KEYS,
  ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT,
  type AnalyticsOverview,
  type AnalyticsOverviewResponse,
  type PassRateBreakdown,
} from './index'

describe('product-analytics contracts', () => {
  it('exposes the window/population defaults', () => {
    expect(ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT).toBe(14)
    expect(ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT).toBe(2)
    expect(ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT).toBe(28)
  })

  it('maps every targeted metric key to a target env key', () => {
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.readinessGain).toBe('ANALYTICS_TARGET_NORTHSTAR_GAIN')
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.sessionsPerWeek).toBe(
      'ANALYTICS_TARGET_SESSIONS_PER_WEEK',
    )
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.retentionW2).toBe('ANALYTICS_TARGET_W4_RETENTION')
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.retentionW4).toBe('ANALYTICS_TARGET_W4_RETENTION')
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.completionRate).toBe('ANALYTICS_TARGET_COMPLETION_RATE')
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.agentEngagement).toBe(
      'ANALYTICS_TARGET_AGENT_ENGAGEMENT',
    )
    expect(ANALYTICS_METRIC_TARGET_ENV_KEYS.llmCostPerActiveUser).toBe('ANALYTICS_LLM_COST_BUDGET')
  })

  it('does not assign a target to activeUsers or passRateBreakdown', () => {
    const keys = Object.keys(ANALYTICS_METRIC_TARGET_ENV_KEYS)
    expect(keys).not.toContain('activeUsers')
    expect(keys).not.toContain('passRateBreakdown')
  })

  it('keys the pass-rate breakdown by the lifecycle exam-outcome responses', () => {
    const breakdown: PassRateBreakdown = {
      passed: 1,
      did_not_pass: 2,
      not_yet: 3,
      dismissed: 4,
    }
    for (const response of examOutcomeResponses) {
      expect(breakdown[response]).toBeTypeOf('number')
    }
  })

  it('assembles into the stable overview envelope shape', () => {
    const overview: AnalyticsOverview = {
      activeUsers: { value: 5, population: 5 },
      readinessGain: { value: 12, target: 15, population: 5 },
      sessionsPerWeek: { value: 2.5, target: 2, population: 5 },
      retentionW2: {
        value: 0.6,
        target: 0.4,
        cohorts: [{ cohortWeek: '2026-W20', size: 10, retained: 6, fraction: 0.6 }],
      },
      retentionW4: {
        value: 0.4,
        target: 0.4,
        cohorts: [{ cohortWeek: '2026-W20', size: 10, retained: 4, fraction: 0.4 }],
      },
      completionRate: { value: 0.8, target: 0.75, population: 12 },
      agentEngagement: { value: 0.55, target: 0.5, population: 12 },
      llmCostPerActiveUser: { value: 1.2, target: 5, population: 5 },
      passRateBreakdown: {
        value: { passed: 3, did_not_pass: 1, not_yet: 2, dismissed: 0 },
      },
    }
    const response: AnalyticsOverviewResponse = { data: overview }
    expect(response.data.activeUsers.value).toBe(5)
    expect(response.data.passRateBreakdown.value.passed).toBe(3)
  })
})
