import type { RetentionCohort, SessionStatus } from '@readion/shared'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
// Unix epoch (1970-01-01) is a Thursday; Mondays land 4 days later, so shifting by this offset
// makes every week bucket open on Monday 00:00 UTC.
const MONDAY_EPOCH_OFFSET_MS = 4 * DAY_MS
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

export interface ReadinessSample {
  scoreNow: number | null
  scoreAtT: number | null
  calibratedNow: boolean
  calibratedAtT: boolean
}

export interface UserReadinessSamples {
  userId: string
  enrollments: ReadinessSample[]
}

// An enrollment contributes a gain only when readiness is calibrated at BOTH the window start
// and now; an enrollment uncalibrated at either boundary is excluded (returns null), never
// folded in as a zero, so the median reflects only the genuinely measurable population.
export function enrollmentGain(sample: ReadinessSample): number | null {
  if (!sample.calibratedNow || !sample.calibratedAtT) {
    return null
  }
  if (sample.scoreNow === null || sample.scoreAtT === null) {
    return null
  }
  return sample.scoreNow - sample.scoreAtT
}

// North-star reading: the median per-user readiness gain across the active population. A user
// with several calibrated enrollments averages their per-enrollment gains into a single
// per-user gain so multi-cert users are weighted once; a user whose every enrollment is
// excluded contributes nothing to the median.
export function medianReadinessGain(users: UserReadinessSamples[]): number {
  const perUserGains: number[] = []
  for (const user of users) {
    const gains = user.enrollments
      .map(enrollmentGain)
      .filter((gain): gain is number => gain !== null)
    if (gains.length === 0) {
      continue
    }
    perUserGains.push(gains.reduce((sum, gain) => sum + gain, 0) / gains.length)
  }
  return median(perUserGains)
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

export interface CohortUser {
  userId: string
  createdAt: Date
  sessions: TerminalSession[]
}

export interface RetentionOptions {
  now: Date
  windowDays: number
  minSessions: number
}

export interface RetentionWeekSummary {
  value: number
  population: number
  cohorts: RetentionCohort[]
}

export interface RetentionReadModel {
  w2: RetentionWeekSummary
  w4: RetentionWeekSummary
}

// Stable, timezone-independent registration-week bucket: the Monday 00:00 UTC at or before the
// registration instant. Used as the cohort key.
export function registrationWeekStart(createdAt: Date): Date {
  const weekIndex = Math.floor((createdAt.getTime() - MONDAY_EPOCH_OFFSET_MS) / WEEK_MS)
  return new Date(weekIndex * WEEK_MS + MONDAY_EPOCH_OFFSET_MS)
}

// "Active in week N" = the active-user predicate evaluated AS OF the end of week N after the
// user's own registration (boundary = registration + weekNumber * 7 days). Reuses isActiveUser
// so the active definition is never forked.
function isActiveInWeek(user: CohortUser, weekNumber: number, options: RetentionOptions): boolean {
  const boundary = new Date(user.createdAt.getTime() + weekNumber * WEEK_MS)
  return isActiveUser({
    sessions: user.sessions,
    now: boundary,
    windowDays: options.windowDays,
    minSessions: options.minSessions,
  })
}

// A cohort's week-N figure is only meaningful once every member has reached their week-N boundary
// relative to the reporting instant; until then the cohort is immature for that week and omitted.
function isCohortMature(users: CohortUser[], weekNumber: number, now: Date): boolean {
  const latestBoundary = Math.max(...users.map((u) => u.createdAt.getTime() + weekNumber * WEEK_MS))
  return latestBoundary <= now.getTime()
}

function weekSummary(
  cohorts: Map<string, CohortUser[]>,
  weekNumber: number,
  options: RetentionOptions,
): RetentionWeekSummary {
  const rows: RetentionCohort[] = []
  let pooledRetained = 0
  let pooledSize = 0
  for (const [cohortWeek, users] of cohorts) {
    if (!isCohortMature(users, weekNumber, options.now)) {
      continue
    }
    const retained = users.filter((u) => isActiveInWeek(u, weekNumber, options)).length
    const size = users.length
    rows.push({ cohortWeek, size, retained, fraction: retained / size })
    pooledRetained += retained
    pooledSize += size
  }
  rows.sort((a, b) => a.cohortWeek.localeCompare(b.cohortWeek))
  return {
    value: pooledSize === 0 ? 0 : pooledRetained / pooledSize,
    population: pooledSize,
    cohorts: rows,
  }
}

export function cohortRetention(
  users: CohortUser[],
  options: RetentionOptions,
): RetentionReadModel {
  const cohorts = new Map<string, CohortUser[]>()
  for (const user of users) {
    const key = registrationWeekStart(user.createdAt).toISOString().slice(0, 10)
    const group = cohorts.get(key) ?? []
    group.push(user)
    cohorts.set(key, group)
  }
  return {
    w2: weekSummary(cohorts, 2, options),
    w4: weekSummary(cohorts, 4, options),
  }
}
