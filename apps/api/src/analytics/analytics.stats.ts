import type { SessionStatus } from '@readion/shared'

const DAY_MS = 86_400_000
const TERMINAL_COMPLETED: ReadonlyArray<SessionStatus> = ['completed', 'partial']

export interface TerminalSession {
  status: SessionStatus
  endedAt: Date | null
}

export interface UserSessionGroup {
  userId: string
  sessions: TerminalSession[]
}

export interface WindowOptions {
  now: Date
  windowDays: number
  minSessions: number
}

export interface ActiveUserSelection {
  userIds: string[]
  completedByUser: Map<string, number>
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function completionRate(input: { reachedSummary: number; started: number }): number {
  return input.started === 0 ? 0 : input.reachedSummary / input.started
}

export function agentEngagementFraction(input: {
  sessionsWithAgent: number
  totalSessions: number
}): number {
  return input.totalSessions === 0 ? 0 : input.sessionsWithAgent / input.totalSessions
}

export function sessionsPerWeek(completedSessions: number, windowDays: number): number {
  const weeks = windowDays / 7
  return weeks === 0 ? 0 : completedSessions / weeks
}

export function windowStart(now: Date, windowDays: number): Date {
  return new Date(now.getTime() - windowDays * DAY_MS)
}

export function isWithinWindow(at: Date, now: Date, windowDays: number): boolean {
  const start = windowStart(now, windowDays).getTime()
  const ms = at.getTime()
  return ms >= start && ms <= now.getTime()
}

function isCompletedInWindow(session: TerminalSession, now: Date, windowDays: number): boolean {
  return (
    TERMINAL_COMPLETED.includes(session.status) &&
    session.endedAt !== null &&
    isWithinWindow(session.endedAt, now, windowDays)
  )
}

export function countCompletedInWindow(
  sessions: TerminalSession[],
  now: Date,
  windowDays: number,
): number {
  return sessions.filter((s) => isCompletedInWindow(s, now, windowDays)).length
}

export function isActiveUser(input: { sessions: TerminalSession[] } & WindowOptions): boolean {
  const completed = countCompletedInWindow(input.sessions, input.now, input.windowDays)
  return completed >= input.minSessions
}

export function selectActiveUsers(
  groups: UserSessionGroup[],
  options: WindowOptions,
): ActiveUserSelection {
  const userIds: string[] = []
  const completedByUser = new Map<string, number>()
  for (const group of groups) {
    const completed = countCompletedInWindow(group.sessions, options.now, options.windowDays)
    if (completed >= options.minSessions) {
      userIds.push(group.userId)
      completedByUser.set(group.userId, completed)
    }
  }
  return { userIds, completedByUser }
}

export function medianSessionsPerWeek(
  completedByUser: Map<string, number>,
  activeUserIds: string[],
  windowDays: number,
): number {
  const rates = activeUserIds.map((id) => sessionsPerWeek(completedByUser.get(id) ?? 0, windowDays))
  return median(rates)
}
