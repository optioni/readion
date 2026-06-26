import type { ReviewItemState } from '@readion/shared'
import { LEITNER_CONFIDENT_THRESHOLD } from '@readion/shared'

export type LeitnerPosition = { box: number; state: ReviewItemState }
export type LeitnerAnswer = { correct: boolean; confidence: number }
export type LeitnerOutcome = { box: number; state: ReviewItemState; dueInDays: number | null }

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function applyLeitner(
  current: LeitnerPosition,
  answer: LeitnerAnswer,
  intervalsDays: readonly number[],
): LeitnerOutcome {
  const confident = answer.confidence >= LEITNER_CONFIDENT_THRESHOLD

  if (!answer.correct) {
    return { box: 1, state: 'active', dueInDays: intervalsDays[0]! }
  }

  if (confident) {
    const nextBox = current.box + 1
    if (nextBox > intervalsDays.length) {
      return { box: current.box, state: 'mastered', dueInDays: null }
    }
    return { box: nextBox, state: 'active', dueInDays: intervalsDays[nextBox - 1]! }
  }

  return { box: current.box, state: 'active', dueInDays: intervalsDays[current.box - 1]! }
}

export function nextDueAt(now: Date, dueInDays: number): Date {
  return new Date(now.getTime() + dueInDays * MS_PER_DAY)
}
