import { LEITNER_INTERVALS_DAYS_DEFAULT } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { applyLeitner, nextDueAt } from './leitner'

const INTERVALS = [...LEITNER_INTERVALS_DAYS_DEFAULT]

describe('applyLeitner', () => {
  it('promotes one box and reschedules at the new interval on correct + confident', () => {
    const outcome = applyLeitner(
      { box: 2, state: 'active' },
      { correct: true, confidence: 4 },
      INTERVALS,
    )
    expect(outcome).toEqual({ box: 3, state: 'active', dueInDays: 7 })
  })

  it('resets to box 1 on a wrong answer', () => {
    const outcome = applyLeitner(
      { box: 4, state: 'active' },
      { correct: false, confidence: 5 },
      INTERVALS,
    )
    expect(outcome).toEqual({ box: 1, state: 'active', dueInDays: 1 })
  })

  it('holds the current box on correct-but-unsure', () => {
    const outcome = applyLeitner(
      { box: 3, state: 'active' },
      { correct: true, confidence: 2 },
      INTERVALS,
    )
    expect(outcome).toEqual({ box: 3, state: 'active', dueInDays: 7 })
  })

  it('masters the concept when promoted past the top box', () => {
    const outcome = applyLeitner(
      { box: 5, state: 'active' },
      { correct: true, confidence: 5 },
      INTERVALS,
    )
    expect(outcome).toEqual({ box: 5, state: 'mastered', dueInDays: null })
  })

  it('treats confidence below the threshold as unsure even when correct', () => {
    const atBox1 = applyLeitner(
      { box: 1, state: 'active' },
      { correct: true, confidence: 1 },
      INTERVALS,
    )
    expect(atBox1).toEqual({ box: 1, state: 'active', dueInDays: 1 })
  })

  it('uses the provided intervals rather than hardcoded values', () => {
    const overridden = [2, 5, 10, 20, 40]
    const outcome = applyLeitner(
      { box: 1, state: 'active' },
      { correct: true, confidence: 4 },
      overridden,
    )
    expect(outcome).toEqual({ box: 2, state: 'active', dueInDays: 5 })
  })
})

describe('nextDueAt', () => {
  it('adds the given days to the provided instant', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(nextDueAt(now, 3).toISOString()).toBe('2026-01-04T00:00:00.000Z')
  })
})
