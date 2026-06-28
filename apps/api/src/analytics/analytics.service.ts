import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AgentConversation, AgentMessage, StudySession, UserCertification } from '@readion/db'
import {
  ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT,
  ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT,
  ANALYTICS_NORTHSTAR_WINDOW_DAYS_DEFAULT,
  READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT,
} from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import { ReadinessService } from '../readiness/readiness.service'
import {
  agentEngagementFraction,
  completionRate,
  medianReadinessGain,
  medianSessionsPerWeek,
  type ReadinessSample,
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

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig>,
    private readonly window: AnalyticsWindow,
    private readonly readiness: ReadinessService,
    private readonly asOfReadiness: AsOfReadiness,
  ) {}

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
  async getReadinessGain(now = this.window.now()): Promise<number> {
    const windowStart = this.window.start(this.northstarWindowDays(), now)
    const { userIds } = await this.getActiveUserPopulation(now)
    const threshold = this.calibrationThreshold()
    const em = this.em.fork()

    const users: UserReadinessSamples[] = []
    for (const userId of userIds) {
      const enrollments = await em.find(UserCertification, { user: userId })
      const samples: ReadinessSample[] = []
      for (const enrollment of enrollments) {
        const nowReadiness = await this.readiness.compute(enrollment.id)
        const startReadiness = await this.asOfReadiness.computeAt(
          enrollment.id,
          windowStart,
          threshold,
        )
        samples.push({
          scoreNow: nowReadiness.score,
          scoreAtT: startReadiness.score,
          calibratedNow: nowReadiness.calibrated,
          calibratedAtT: startReadiness.calibrated,
        })
      }
      users.push({ userId, enrollments: samples })
    }

    return medianReadinessGain(users)
  }

  async getSessionsPerWeek(now = this.window.now()): Promise<number> {
    const { userIds, completedByUser } = await this.getActiveUserPopulation(now)
    return medianSessionsPerWeek(completedByUser, userIds, this.windowDays())
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
