import type { ExamOutcomeResponse } from '@readion/shared'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface NudgePolicyInput {
  /** UTC instant of "now" (injectable for tests). */
  now: Date
  /** A recorded outcome (including a dismissal) stops all nudges. */
  examOutcomeResponse: ExamOutcomeResponse | null
  /** Total nudges already sent for this enrollment. */
  nudgeCount: number
  /** When the most recent nudge was sent, or null if none has been sent. */
  nudgeSentAt: Date | null
  /** Maximum follow-ups allowed after the first nudge. */
  maxFollowups: number
  /** Days that must elapse after a nudge before a follow-up may be sent. */
  followupDelayDays: number
}

/**
 * The allowance/follow-up policy, independent of the readiness gate. A first nudge is
 * always permitted; each follow-up is permitted only after the configured delay has
 * elapsed since the previous nudge, up to the maximum number of follow-ups, and never
 * once any response has been recorded.
 */
export function shouldSendNudge(input: NudgePolicyInput): boolean {
  if (input.examOutcomeResponse !== null) {
    return false
  }
  if (input.nudgeCount >= 1 + input.maxFollowups) {
    return false
  }
  if (input.nudgeCount >= 1) {
    if (input.nudgeSentAt === null) {
      return false
    }
    const delayMs = input.followupDelayDays * MS_PER_DAY
    if (input.now.getTime() - input.nudgeSentAt.getTime() < delayMs) {
      return false
    }
  }
  return true
}
