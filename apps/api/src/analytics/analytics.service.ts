import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AgentConversation,
  AgentMessage,
  MockExam,
  QuizResponse,
  SessionItem,
  StudySession,
  User,
  UserCertification,
} from '@readion/db'
import {
  ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT,
  ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT,
  ANALYTICS_COST_AGENT_MESSAGE_DEFAULT,
  ANALYTICS_COST_MOCK_QUESTION_DEFAULT,
  ANALYTICS_COST_QUIZ_DEFAULT,
  ANALYTICS_COST_SESSION_ITEM_DEFAULT,
  ANALYTICS_LLM_COST_BUDGET_DEFAULT,
  ANALYTICS_METRIC_TARGET_ENV_KEYS,
  ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT,
  ANALYTICS_TARGET_AGENT_ENGAGEMENT_DEFAULT,
  ANALYTICS_TARGET_COMPLETION_RATE_DEFAULT,
  ANALYTICS_TARGET_NORTHSTAR_GAIN_DEFAULT,
  ANALYTICS_TARGET_SESSIONS_PER_WEEK_DEFAULT,
  ANALYTICS_TARGET_W4_RETENTION_DEFAULT,
  type AnalyticsOverview,
  type AnalyticsTargetedMetricKey,
  type PassRateBreakdown,
  READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT,
} from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import type { EnvConfig } from '../config/env.schema'
import { ReadinessService } from '../readiness/readiness.service'
import { ANALYTICS_ACTIVE_USERS_GAUGE, ANALYTICS_NORTHSTAR_GAIN_GAUGE } from './analytics.metrics'
import {
  agentEngagementFraction,
  type CohortUser,
  cohortRetention,
  completionRate,
  type LlmArtifactCounts,
  type LlmCostCoefficients,
  llmCostPerActiveUser,
  medianReadinessGain,
  medianSessionsPerWeek,
  type ReadinessSample,
  type RetentionReadModel,
  selectActiveUsers,
  type TerminalSession,
  type UserReadinessSamples,
  type UserSessionGroup,
} from './analytics.stats'
import { AnalyticsWindow } from './analytics-window'
import { AsOfReadiness } from './as-of-readiness'

export interface ActiveUserPopulation {
  userIds: string[]
  count: number
  completedByUser: Map<string, number>
}

// Fallback targets mirroring the env-fragment defaults, keyed by the same metric keys as the
// single-source env mapping. retentionW2 and retentionW4 share the W4 target by design.
const ANALYTICS_METRIC_TARGET_DEFAULTS: Record<AnalyticsTargetedMetricKey, number> = {
  readinessGain: ANALYTICS_TARGET_NORTHSTAR_GAIN_DEFAULT,
  sessionsPerWeek: ANALYTICS_TARGET_SESSIONS_PER_WEEK_DEFAULT,
  retentionW2: ANALYTICS_TARGET_W4_RETENTION_DEFAULT,
  retentionW4: ANALYTICS_TARGET_W4_RETENTION_DEFAULT,
  completionRate: ANALYTICS_TARGET_COMPLETION_RATE_DEFAULT,
  agentEngagement: ANALYTICS_TARGET_AGENT_ENGAGEMENT_DEFAULT,
  llmCostPerActiveUser: ANALYTICS_LLM_COST_BUDGET_DEFAULT,
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
    private readonly window: AnalyticsWindow,
    private readonly readiness: ReadinessService,
    private readonly asOfReadiness: AsOfReadiness,
    @InjectMetric(ANALYTICS_ACTIVE_USERS_GAUGE)
    private readonly activeUsersGauge: Gauge<string>,
    @InjectMetric(ANALYTICS_NORTHSTAR_GAIN_GAUGE)
    private readonly northstarGainGauge: Gauge<string>,
  ) {}

  // Assembles every read model into the overview envelope. All sections share ONE reporting
  // instant so the figures are internally consistent. Each targeted section is paired with its
  // configured target via the single-source ANALYTICS_METRIC_TARGET_ENV_KEYS mapping, and the
  // active-population/retention-cohort sizes are surfaced so a reader can gauge significance.
  async getOverview(now = this.window.now()): Promise<AnalyticsOverview> {
    const population = await this.getActiveUserPopulation(now)
    const [
      readinessGain,
      sessionsPerWeek,
      completionRate,
      agentEngagement,
      llmCostPerActiveUser,
      retention,
      passRateBreakdown,
    ] = await Promise.all([
      this.getReadinessGain(now, population),
      this.getSessionsPerWeek(now, population),
      this.getCompletionRate(now),
      this.getAgentEngagementRate(now),
      this.getLlmCostPerActiveUser(now, population),
      this.getRetentionCohorts(now),
      this.getPassRateBreakdown(),
    ])

    this.activeUsersGauge.set(population.count)
    this.northstarGainGauge.set(readinessGain)

    return {
      activeUsers: { value: population.count, population: population.count },
      readinessGain: {
        value: readinessGain,
        target: this.metricTarget('readinessGain'),
        population: population.count,
      },
      sessionsPerWeek: {
        value: sessionsPerWeek,
        target: this.metricTarget('sessionsPerWeek'),
        population: population.count,
      },
      retentionW2: {
        value: retention.w2.value,
        target: this.metricTarget('retentionW2'),
        population: retention.w2.population,
        cohorts: retention.w2.cohorts,
      },
      retentionW4: {
        value: retention.w4.value,
        target: this.metricTarget('retentionW4'),
        population: retention.w4.population,
        cohorts: retention.w4.cohorts,
      },
      completionRate: { value: completionRate, target: this.metricTarget('completionRate') },
      agentEngagement: { value: agentEngagement, target: this.metricTarget('agentEngagement') },
      llmCostPerActiveUser: {
        value: llmCostPerActiveUser,
        target: this.metricTarget('llmCostPerActiveUser'),
        population: population.count,
      },
      passRateBreakdown: { value: passRateBreakdown },
    }
  }

  private metricTarget(key: AnalyticsTargetedMetricKey): number {
    return (
      this.config.get(ANALYTICS_METRIC_TARGET_ENV_KEYS[key], { infer: true }) ??
      ANALYTICS_METRIC_TARGET_DEFAULTS[key]
    )
  }

  async getActiveUserPopulation(now = this.window.now()): Promise<ActiveUserPopulation> {
    const windowDays = this.windowDays()
    const start = this.window.start(windowDays, now)
    const em = this.em.fork()
    const sessions = await em.find(StudySession, {
      status: { $in: ['completed', 'partial'] },
      endedAt: { $gte: start, $lte: now },
    })
    const { userIds, completedByUser } = selectActiveUsers(this.groupByUser(sessions), {
      now,
      windowDays,
      minSessions: this.minSessions(),
    })
    return { userIds, count: userIds.length, completedByUser }
  }

  // North-star: the median per-user readiness gain (readiness now − readiness at the 28-day
  // window start) across the active population. Readiness-now reuses ReadinessService; the
  // window-start value is recomputed as-of T from immutable rows (AsOfReadiness). An enrollment
  // uncalibrated at either boundary is excluded from the median, never folded in as a zero.
  async getReadinessGain(
    now = this.window.now(),
    population?: ActiveUserPopulation,
  ): Promise<number> {
    const windowStart = this.window.start(this.northstarWindowDays(), now)
    const { userIds } = population ?? (await this.getActiveUserPopulation(now))
    const threshold = this.calibrationThreshold()
    const em = this.em.fork()

    const users: UserReadinessSamples[] = []
    for (const userId of userIds) {
      const enrollments = await em.find(UserCertification, { user: userId })
      const samples = await Promise.all(
        enrollments.map((e) => this.sampleReadiness(e.id, windowStart, threshold)),
      )
      users.push({ userId, enrollments: samples })
    }

    return medianReadinessGain(users)
  }

  // Pairs an enrollment's current readiness (live ReadinessService) with its readiness as of the
  // window start (AsOfReadiness — the single isolated seam over the timestamped rows). The gain
  // exclusion logic lives in medianReadinessGain; this only assembles the paired sample.
  private async sampleReadiness(
    enrollmentId: string,
    windowStart: Date,
    threshold: number,
  ): Promise<ReadinessSample> {
    const nowReadiness = await this.readiness.compute(enrollmentId)
    const startReadiness = await this.asOfReadiness.computeAt(enrollmentId, windowStart, threshold)
    return {
      scoreNow: nowReadiness.score,
      scoreAtT: startReadiness.score,
      calibratedNow: nowReadiness.calibrated,
      calibratedAtT: startReadiness.calibrated,
    }
  }

  async getSessionsPerWeek(
    now = this.window.now(),
    population?: ActiveUserPopulation,
  ): Promise<number> {
    const { userIds, completedByUser } = population ?? (await this.getActiveUserPopulation(now))
    return medianSessionsPerWeek(completedByUser, userIds, this.windowDays())
  }

  // Registration-week retention: users grouped by the calendar week of User.createdAt, each
  // evaluated against the SAME active-user predicate as of their own week-2 (registration + 14d)
  // and week-4 (registration + 28d) boundaries. A cohort is reported for a week only once every
  // member has reached that week's boundary relative to `now`; immature cohorts are omitted.
  async getRetentionCohorts(now = this.window.now()): Promise<RetentionReadModel> {
    const em = this.em.fork()
    const [users, sessions] = await Promise.all([
      em.find(User, {}),
      em.find(StudySession, {
        status: { $in: ['completed', 'partial'] },
        endedAt: { $ne: null },
      }),
    ])

    const sessionsByUser = new Map<string, TerminalSession[]>()
    for (const session of sessions) {
      const list = sessionsByUser.get(session.user.id) ?? []
      list.push({ status: session.status, endedAt: session.endedAt })
      sessionsByUser.set(session.user.id, list)
    }

    const cohortUsers: CohortUser[] = users.map((user) => ({
      userId: user.id,
      createdAt: user.createdAt,
      sessions: sessionsByUser.get(user.id) ?? [],
    }))

    return cohortRetention(cohortUsers, {
      now,
      windowDays: this.windowDays(),
      minSessions: this.minSessions(),
    })
  }

  async getCompletionRate(now = this.window.now()): Promise<number> {
    const start = this.window.start(this.windowDays(), now)
    const em = this.em.fork()
    const started = await em.find(StudySession, { startedAt: { $gte: start, $lte: now } })
    const reachedSummary = started.filter(
      (s) => s.status === 'completed' || s.status === 'partial',
    ).length
    return completionRate({ reachedSummary, started: started.length })
  }

  async getAgentEngagementRate(now = this.window.now()): Promise<number> {
    const start = this.window.start(this.windowDays(), now)
    const em = this.em.fork()
    const started = await em.find(StudySession, { startedAt: { $gte: start, $lte: now } })
    if (started.length === 0) {
      return agentEngagementFraction({ sessionsWithAgent: 0, totalSessions: 0 })
    }

    const sessionIds = started.map((s) => s.id)
    const conversations = await em.find(AgentConversation, {
      studySessionId: { $in: sessionIds },
      deletedAt: null,
    })
    const conversationIds = conversations.map((c) => c.id)
    const engagedConversationIds =
      conversationIds.length === 0
        ? new Set<string>()
        : new Set(
            (
              await em.find(AgentMessage, {
                conversationId: { $in: conversationIds },
                role: 'user',
              })
            ).map((m) => m.conversationId),
          )
    const engagedSessionIds = new Set(
      conversations
        .filter((c) => c.studySessionId !== null && engagedConversationIds.has(c.id))
        .map((c) => c.studySessionId as string),
    )

    return agentEngagementFraction({
      sessionsWithAgent: engagedSessionIds.size,
      totalSessions: sessionIds.length,
    })
  }

  // ESTIMATED LLM cost per active user over the active window: a derived proxy, not a measured
  // spend (no per-user token cost is persisted). Sums LLM-driven artifacts attributable to the
  // active population — quiz responses, mock-exam question counts, session-item generations, and
  // assistant/tool agent messages — each weighted by its configured cost coefficient, divided by
  // the active-user count. The agent/SSE-error-rate and ingestion-success ops guardrails are NOT
  // re-derived here (those stay in Prometheus).
  async getLlmCostPerActiveUser(
    now = this.window.now(),
    population?: ActiveUserPopulation,
  ): Promise<number> {
    const { userIds, count } = population ?? (await this.getActiveUserPopulation(now))
    const counts =
      count === 0
        ? { quizResponses: 0, mockQuestions: 0, sessionItems: 0, agentMessages: 0 }
        : await this.countLlmArtifacts(userIds, now)
    return llmCostPerActiveUser({
      counts,
      coefficients: this.costCoefficients(),
      activeUserCount: count,
    })
  }

  // Each artifact is windowed by its OWN createdAt — the instant the LLM cost was incurred at
  // generation time — within the trailing active window, and attributed to the active population:
  // quiz responses via userCertification.user, mock exams via the direct user FK (summing
  // questions.length), session items via session.user, and agent messages via their conversation's
  // userId. The artifact's createdAt is the most defensible cost-incurrence timestamp; this is
  // independent of how the active population itself is windowed (by session endedAt).
  private async countLlmArtifacts(userIds: string[], now: Date): Promise<LlmArtifactCounts> {
    const start = this.window.start(this.windowDays(), now)
    const window = { $gte: start, $lte: now }
    const em = this.em.fork()

    const quizResponses = await em.count(QuizResponse, {
      userCertification: { user: { $in: userIds } },
      createdAt: window,
    })

    const sessionItems = await em.count(SessionItem, {
      session: { user: { $in: userIds } },
      createdAt: window,
    })

    const mockExams = await em.find(MockExam, {
      user: { $in: userIds },
      createdAt: window,
    })
    const mockQuestions = mockExams.reduce((sum, exam) => sum + exam.questions.length, 0)

    const conversationIds = (await em.find(AgentConversation, { userId: { $in: userIds } })).map(
      (c) => c.id,
    )
    const agentMessages =
      conversationIds.length === 0
        ? 0
        : await em.count(AgentMessage, {
            conversationId: { $in: conversationIds },
            role: { $in: ['assistant', 'tool'] },
            createdAt: window,
          })

    return { quizResponses, mockQuestions, sessionItems, agentMessages }
  }

  // Lagging, DISPLAY-ONLY self-reported real-exam outcome: a tally of every recorded
  // `examOutcomeResponse` across ALL enrollments (not scoped to the active population or a window).
  // Enrollments without a recorded outcome are simply not counted; an empty result yields all-zeros
  // rather than throwing. This never feeds another metric or the readiness score.
  async getPassRateBreakdown(): Promise<PassRateBreakdown> {
    const em = this.em.fork()
    const enrollments = await em.find(UserCertification, { examOutcomeResponse: { $ne: null } })
    const breakdown: PassRateBreakdown = { passed: 0, did_not_pass: 0, not_yet: 0, dismissed: 0 }
    for (const enrollment of enrollments) {
      if (enrollment.examOutcomeResponse !== null) {
        breakdown[enrollment.examOutcomeResponse] += 1
      }
    }
    return breakdown
  }

  private costCoefficients(): LlmCostCoefficients {
    return {
      quiz: this.config.get('ANALYTICS_COST_QUIZ', { infer: true }) ?? ANALYTICS_COST_QUIZ_DEFAULT,
      mockQuestion:
        this.config.get('ANALYTICS_COST_MOCK_QUESTION', { infer: true }) ??
        ANALYTICS_COST_MOCK_QUESTION_DEFAULT,
      sessionItem:
        this.config.get('ANALYTICS_COST_SESSION_ITEM', { infer: true }) ??
        ANALYTICS_COST_SESSION_ITEM_DEFAULT,
      agentMessage:
        this.config.get('ANALYTICS_COST_AGENT_MESSAGE', { infer: true }) ??
        ANALYTICS_COST_AGENT_MESSAGE_DEFAULT,
    }
  }

  private groupByUser(sessions: StudySession[]): UserSessionGroup[] {
    const groups = new Map<string, TerminalSession[]>()
    for (const session of sessions) {
      const list = groups.get(session.user.id) ?? []
      list.push({ status: session.status, endedAt: session.endedAt })
      groups.set(session.user.id, list)
    }
    return [...groups].map(([userId, terminalSessions]) => ({
      userId,
      sessions: terminalSessions,
    }))
  }

  private windowDays(): number {
    return (
      this.config.get('ANALYTICS_ACTIVE_WINDOW_DAYS', { infer: true }) ??
      ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT
    )
  }

  private minSessions(): number {
    return (
      this.config.get('ANALYTICS_ACTIVE_MIN_SESSIONS', { infer: true }) ??
      ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT
    )
  }

  private northstarWindowDays(): number {
    return (
      this.config.get('ANALYTICS_NORTHSTAR_WINDOW_DAYS', { infer: true }) ??
      ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT
    )
  }

  private calibrationThreshold(): number {
    return (
      this.config.get('READINESS_CALIBRATION_MIN_ANSWERS', { infer: true }) ??
      READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT
    )
  }
}
