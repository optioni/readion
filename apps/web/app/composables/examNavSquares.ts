export type ExamNavMode = 'preparing' | 'active' | 'review'

export type ReviewOutcome = 'correct' | 'incorrect' | 'skipped'

export type NavSquareState = 'ready' | 'answered' | 'current' | 'unanswered' | ReviewOutcome

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
  return Array.from({ length: input.total }, (_, index) => {
    let state: NavSquareState = 'unanswered'
    if (index === input.currentIndex) {
      state = 'current'
    } else if (answered.has(index)) {
      state = 'answered'
    }
    return { index, label: index + 1, state }
  })
}
