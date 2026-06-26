import { describe, expect, it } from 'vitest'
import {
  mockQuestionQualifies,
  selectDrillTargets,
  sessionResponseQualifies,
  type MockQuestionTarget,
  type SessionResponseTarget,
} from './drill-targets'

describe('sessionResponseQualifies', () => {
  it('incorrect response always qualifies regardless of confidence', () => {
    expect(sessionResponseQualifies({ correct: false, confidence: 5 }, 2)).toBe(true)
  })

  it('correct + confidence=1 qualifies (flagged-unsure, below threshold)', () => {
    expect(sessionResponseQualifies({ correct: true, confidence: 1 }, 2)).toBe(true)
  })

  it('correct + confidence=2 qualifies (at threshold)', () => {
    expect(sessionResponseQualifies({ correct: true, confidence: 2 }, 2)).toBe(true)
  })

  it('correct + confidence=3 does NOT qualify (above threshold of 2)', () => {
    expect(sessionResponseQualifies({ correct: true, confidence: 3 }, 2)).toBe(false)
  })

  it('correct + confidence=5 does NOT qualify', () => {
    expect(sessionResponseQualifies({ correct: true, confidence: 5 }, 2)).toBe(false)
  })
})

describe('mockQuestionQualifies', () => {
  it('selectedAnswer=null qualifies (unanswered)', () => {
    expect(mockQuestionQualifies({ selectedAnswer: null, correctAnswer: 'A' })).toBe(true)
  })

  it('selectedAnswer !== correctAnswer qualifies (wrong answer)', () => {
    expect(mockQuestionQualifies({ selectedAnswer: 'B', correctAnswer: 'A' })).toBe(true)
  })

  it('selectedAnswer === correctAnswer does NOT qualify (correct)', () => {
    expect(mockQuestionQualifies({ selectedAnswer: 'A', correctAnswer: 'A' })).toBe(false)
  })
})

describe('selectDrillTargets (session type)', () => {
  const sessionTarget = (
    overrides: Partial<SessionResponseTarget> = {},
  ): SessionResponseTarget => ({
    correct: false,
    confidence: 1,
    domain: 'compute',
    anchorChunkId: 'chunk-1',
    ...overrides,
  })

  it('empty input returns empty array', () => {
    expect(selectDrillTargets([], 'session', { unsureThreshold: 2, maxTargets: 7 })).toEqual([])
  })

  it('all correct, high-confidence responses return empty array', () => {
    const targets: SessionResponseTarget[] = [
      sessionTarget({ correct: true, confidence: 5, anchorChunkId: 'chunk-1' }),
      sessionTarget({ correct: true, confidence: 4, anchorChunkId: 'chunk-2' }),
    ]
    expect(selectDrillTargets(targets, 'session', { unsureThreshold: 2, maxTargets: 7 })).toEqual(
      [],
    )
  })

  it('one wrong response returns a single ReviewTarget', () => {
    const targets: SessionResponseTarget[] = [
      sessionTarget({ correct: false, confidence: 5, domain: 'networking', anchorChunkId: 'chunk-x' }),
    ]
    const result = selectDrillTargets(targets, 'session', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toEqual([{ domain: 'networking', anchorChunkId: 'chunk-x' }])
  })

  it('deduplicates: two wrong answers with same anchorChunkId yield only one target', () => {
    const targets: SessionResponseTarget[] = [
      sessionTarget({ correct: false, confidence: 1, domain: 'compute', anchorChunkId: 'chunk-shared' }),
      sessionTarget({ correct: false, confidence: 2, domain: 'compute', anchorChunkId: 'chunk-shared' }),
    ]
    const result = selectDrillTargets(targets, 'session', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ domain: 'compute', anchorChunkId: 'chunk-shared' })
  })

  it('caps at maxTargets when more targets qualify', () => {
    const targets: SessionResponseTarget[] = Array.from({ length: 10 }, (_, i) =>
      sessionTarget({ correct: false, confidence: 1, domain: 'compute', anchorChunkId: `chunk-${i}` }),
    )
    const result = selectDrillTargets(targets, 'session', { unsureThreshold: 2, maxTargets: 3 })
    expect(result).toHaveLength(3)
  })

  it('mixed: only qualifying responses are included', () => {
    const targets: SessionResponseTarget[] = [
      sessionTarget({ correct: true, confidence: 5, domain: 'storage', anchorChunkId: 'chunk-pass-1' }),
      sessionTarget({ correct: false, confidence: 3, domain: 'compute', anchorChunkId: 'chunk-fail-1' }),
      sessionTarget({ correct: true, confidence: 4, domain: 'networking', anchorChunkId: 'chunk-pass-2' }),
      sessionTarget({ correct: true, confidence: 2, domain: 'iam', anchorChunkId: 'chunk-fail-2' }),
    ]
    const result = selectDrillTargets(targets, 'session', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toHaveLength(2)
    const chunkIds = result.map((r) => r.anchorChunkId)
    expect(chunkIds).toContain('chunk-fail-1')
    expect(chunkIds).toContain('chunk-fail-2')
  })
})

describe('selectDrillTargets (mock type)', () => {
  const mockTarget = (overrides: Partial<MockQuestionTarget> = {}): MockQuestionTarget => ({
    selectedAnswer: 'B',
    correctAnswer: 'A',
    domain: 'compute',
    anchorChunkId: 'chunk-1',
    ...overrides,
  })

  it('empty input returns empty array', () => {
    expect(selectDrillTargets([], 'mock', { unsureThreshold: 2, maxTargets: 7 })).toEqual([])
  })

  it('all correct answers return empty array', () => {
    const targets: MockQuestionTarget[] = [
      mockTarget({ selectedAnswer: 'A', correctAnswer: 'A', anchorChunkId: 'chunk-1' }),
      mockTarget({ selectedAnswer: 'C', correctAnswer: 'C', anchorChunkId: 'chunk-2' }),
    ]
    expect(selectDrillTargets(targets, 'mock', { unsureThreshold: 2, maxTargets: 7 })).toEqual([])
  })

  it('unanswered question (selectedAnswer=null) qualifies', () => {
    const targets: MockQuestionTarget[] = [
      mockTarget({ selectedAnswer: null, correctAnswer: 'A', domain: 'storage', anchorChunkId: 'chunk-unanswered' }),
    ]
    const result = selectDrillTargets(targets, 'mock', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toEqual([{ domain: 'storage', anchorChunkId: 'chunk-unanswered' }])
  })

  it('wrong answer qualifies', () => {
    const targets: MockQuestionTarget[] = [
      mockTarget({ selectedAnswer: 'B', correctAnswer: 'A', domain: 'networking', anchorChunkId: 'chunk-wrong' }),
    ]
    const result = selectDrillTargets(targets, 'mock', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toEqual([{ domain: 'networking', anchorChunkId: 'chunk-wrong' }])
  })

  it('deduplicates: two qualifying questions with same anchorChunkId yield only one target', () => {
    const targets: MockQuestionTarget[] = [
      mockTarget({ selectedAnswer: 'B', correctAnswer: 'A', domain: 'compute', anchorChunkId: 'chunk-shared' }),
      mockTarget({ selectedAnswer: null, correctAnswer: 'C', domain: 'compute', anchorChunkId: 'chunk-shared' }),
    ]
    const result = selectDrillTargets(targets, 'mock', { unsureThreshold: 2, maxTargets: 7 })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ domain: 'compute', anchorChunkId: 'chunk-shared' })
  })

  it('caps at maxTargets when more qualifying questions than cap', () => {
    const targets: MockQuestionTarget[] = Array.from({ length: 10 }, (_, i) =>
      mockTarget({ selectedAnswer: 'X', correctAnswer: 'A', domain: 'compute', anchorChunkId: `chunk-${i}` }),
    )
    const result = selectDrillTargets(targets, 'mock', { unsureThreshold: 2, maxTargets: 5 })
    expect(result).toHaveLength(5)
  })
})
