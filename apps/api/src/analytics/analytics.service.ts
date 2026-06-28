import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AgentConversation, AgentMessage, StudySession } from '@readion/db'
import {
  ANALYTICS_ACTIVE_MIN_SESSIONS_DEFAULT,
  ANALYTICS_ACTIVE_WINDOW_DAYS_DEFAULT,
} from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import {
  agentEngagementFraction,
  completionRate,
  medianSessionsPerWeek,
  selectActiveUsers,
  type TerminalSession,
  type UserSessionGroup,
  windowStart,
} from './analytics.stats'

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
  ) {}

  async getActiveUserPopulation(now = this.now()): Promise<ActiveUserPopulation> {
    const windowDays = this.windowDays()
    const start = windowStart(now, windowDays)
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

  async getSessionsPerWeek(now = this.now()): Promise<number> {
    const { userIds, completedByUser } = await this.getActiveUserPopulation(now)
    return medianSessionsPerWeek(completedByUser, userIds, this.windowDays())
  }

  async getCompletionRate(now = this.now()): Promise<number> {
    const start = windowStart(now, this.windowDays())
    const em = this.em.fork()
    const started = await em.find(StudySession, { startedAt: { $gte: start, $lte: now } })
    const reachedSummary = started.filter(
      (s) => s.status === 'completed' || s.status === 'partial',
    ).length
    return completionRate({ reachedSummary, started: started.length })
  }

  async getAgentEngagementRate(now = this.now()): Promise<number> {
    const start = windowStart(now, this.windowDays())
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

  private now(): Date {
    return new Date()
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
}
