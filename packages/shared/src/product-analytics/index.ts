import type { ExamOutcomeResponse } from '../lifecycle-email'

export const ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT = 14
export const ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT = 2
export const ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT = 28

export const ANALYTICS_COST_QUIZ_DEFAULT = 0.01
export const ANALYTICS_COST_MOCK_QUESTION_DEFAULT = 0.02
export const ANALYTICS_COST_SESSION_ITEM_DEFAULT = 0.03
export const ANALYTICS_COST_AGENT_MESSAGE_DEFAULT = 0.02

export const ANALYTICS_TARGET_NORTHSTAR_GAIN_DEFAULT = 15
export const ANALYTICS_TARGET_SESSIONS_PER_WEEK_DEFAULT = 2
export const ANALYTICS_TARGET_W4_RETENTION_DEFAULT = 0.4
export const ANALYTICS_TARGET_COMPLETION_RATE_DEFAULT = 0.75
export const ANALYTICS_TARGET_AGENT_ENGAGEMENT_DEFAULT = 0.5
export const ANALYTICS_LLM_COST_BUDGET_DEFAULT = 5

// Single source of truth: each targeted metric section maps to the env key that holds
// its configured v1 target. The overview DTO derives its targeted-metric keys from this
// mapping so the service and the type never drift. Sections absent here (activeUsers,
// passRateBreakdown) carry no target.
export const ANALYTICS_METRIC_TARGET_ENV_KEYS = {
  readinessGain: 'ANALYTICS_TARGET_NORTHSTAR_GAIN',
  sessionsPerWeek: 'ANALYTICS_TARGET_SESSIONS_PER_WEEK',
  retentionW2: 'ANALYTICS_TARGET_W4_RETENTION',
  retentionW4: 'ANALYTICS_TARGET_W4_RETENTION',
  completionRate: 'ANALYTICS_TARGET_COMPLETION_RATE',
  agentEngagement: 'ANALYTICS_TARGET_AGENT_ENGAGEMENT',
  llmCostPerActiveUser: 'ANALYTICS_LLM_COST_BUDGET',
} as const

export type AnalyticsTargetedMetricKey = keyof typeof ANALYTICS_METRIC_TARGET_ENV_KEYS

export interface AnalyticsMetric {
  value: number
  population?: number
}

export interface AnalyticsTargetedMetric extends AnalyticsMetric {
  target: number
}

export interface RetentionCohort {
  cohortWeek: string
  size: number
  retained: number
  fraction: number
}

export interface RetentionMetric extends AnalyticsTargetedMetric {
  cohorts?: RetentionCohort[]
}

export type PassRateBreakdown = Record<ExamOutcomeResponse, number>

export interface PassRateMetric {
  value: PassRateBreakdown
  population?: number
}

type RetentionMetricKey = 'retentionW2' | 'retentionW4'

export type AnalyticsOverview = {
  activeUsers: AnalyticsMetric
  passRateBreakdown: PassRateMetric
} & {
  [K in AnalyticsTargetedMetricKey]: K extends RetentionMetricKey
    ? RetentionMetric
    : AnalyticsTargetedMetric
}

export interface AnalyticsOverviewResponse {
  data: AnalyticsOverview
}
