export type ExamNavMode = 'preparing' | 'active' | 'review'

export type ReviewOutcome = 'correct' | 'incorrect' | 'skipped'

export type NavSquareState =
  | 'ready'
  | 'answered'
  | 'current'
  | 'unanswered'
  | 'flagged'
  | ReviewOutcome

export interface NavSquare {
  index: number
  label: number
  state: NavSquareState
}

export interface ExamNavSquaresInput {
  mode: ExamNavMode
  total: number
  readyCount?: number
  currentIndex?: number
  answeredIndices?: Iterable<number>
  flaggedIndices?: Iterable<number>
  outcomes?: ReviewOutcome[]
}

export function buildExamNavSquares(input: ExamNavSquaresInput): NavSquare[] {
  if (input.mode === 'preparing') {
    return Array.from({ length: input.readyCount ?? 0 }, (_, index) => ({
      index,
      label: index + 1,
      state: 'ready',
    }))
  }

  if (input.mode === 'review') {
    return (input.outcomes ?? []).map((state, index) => ({ index, label: index + 1, state }))
  }

  const answered = new Set(input.answeredIndices ?? [])
  const flagged = new Set(input.flaggedIndices ?? [])
  return Array.from({ length: input.total }, (_, index) => {
    let state: NavSquareState = 'unanswered'
    // Answered wins over current: a question keeps its answered marker even while it is the one on
    // screen, so persisting an answer to the current question flips its square immediately.
    if (answered.has(index)) {
      state = 'answered'
    } else if (index === input.currentIndex) {
      state = 'current'
    }
    // Flagged wins over everything else: a flagged question renders as "Flagged" in the nav grid
    // regardless of whether it's also answered or the one currently displayed.
    if (flagged.has(index)) {
      state = 'flagged'
    }
    return { index, label: index + 1, state }
  })
}
