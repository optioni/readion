import { describe, expect, it } from 'vitest'
import { buildExamNavSquares } from '~/composables/examNavSquares'

describe('buildExamNavSquares', () => {
  it('builds one ready square per streamed-in question while preparing', () => {
    const squares = buildExamNavSquares({ mode: 'preparing', total: 65, readyCount: 3 })

    expect(squares).toEqual([
      { index: 0, label: 1, state: 'ready' },
      { index: 1, label: 2, state: 'ready' },
      { index: 2, label: 3, state: 'ready' },
    ])
  })

  it('derives answered, current, and unanswered states for the active exam', () => {
    const squares = buildExamNavSquares({
      mode: 'active',
      total: 14,
      currentIndex: 11,
      answeredIndices: Array.from({ length: 11 }, (_, i) => i),
    })

    expect(squares[0]).toEqual({ index: 0, label: 1, state: 'answered' })
    expect(squares[10]).toEqual({ index: 10, label: 11, state: 'answered' })
    expect(squares[11]).toEqual({ index: 11, label: 12, state: 'current' })
    expect(squares[12]).toEqual({ index: 12, label: 13, state: 'unanswered' })
  })

  it('accepts a Set of answered indices', () => {
    const squares = buildExamNavSquares({
      mode: 'active',
      total: 3,
      currentIndex: 2,
      answeredIndices: new Set([0]),
    })

    expect(squares.map((s) => s.state)).toEqual(['answered', 'unanswered', 'current'])
  })

  it('maps per-question outcomes to recoloured review squares', () => {
    const squares = buildExamNavSquares({
      mode: 'review',
      total: 4,
      outcomes: ['correct', 'incorrect', 'skipped', 'correct'],
    })

    expect(squares.map((s) => s.state)).toEqual(['correct', 'incorrect', 'skipped', 'correct'])
    expect(squares.map((s) => s.label)).toEqual([1, 2, 3, 4])
  })

  it('flags a question independently of whether it is answered or current', () => {
    const squares = buildExamNavSquares({
      mode: 'active',
      total: 5,
      currentIndex: 2,
      answeredIndices: [0, 3],
      flaggedIndices: [3],
    })

    expect(squares.map((s) => s.state)).toEqual([
      'answered',
      'unanswered',
      'current',
      'flagged',
      'unanswered',
    ])
  })
})
