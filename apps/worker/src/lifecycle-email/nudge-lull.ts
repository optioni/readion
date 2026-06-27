const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface NudgeLullInput {
  /** UTC instant of "now" (injectable for tests). */
  now: Date
  /** UTC instant of the most-recent study activity, or null if the enrollment has none. */
  lastActivityAt: Date | null
  /** Days of inactivity that mark study as lulled. */
  lullDays: number
}

/**
 * An enrollment is a lull candidate when its most-recent study activity is strictly
 * older than `now - lullDays`. An enrollment with no recorded activity is NOT a
 * candidate: it never had active study to lull from (and the API readiness gate would
 * reject it anyway as uncalibrated).
 */
export function isNudgeLullCandidate(input: NudgeLullInput): boolean {
  if (input.lastActivityAt === null) {
    return false
  }
  const cutoff = input.now.getTime() - input.lullDays * MS_PER_DAY
  return input.lastActivityAt.getTime() < cutoff
}
