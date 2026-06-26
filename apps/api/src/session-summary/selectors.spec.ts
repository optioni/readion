import { describe, expect, it } from 'vitest'
import { selectNextFocus, selectStrongest, selectWeakest } from './selectors'
import type { GradedResponse, WeakAreaScore } from './selectors'

const makeResponse = (overrides: Partial<GradedResponse> & { responseId: string }): GradedResponse => ({
  question: `Question for ${overrides.responseId}`,
  correct: false,
  confidence: 3,
  timeTakenMs: 5000,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
})

describe('selectWeakest', () => {
  it('returns null for empty array', () => {
    expect(selectWeakest([])).toBeNull()
  })

  it('returns the single incorrect response', () => {
    const r = makeResponse({ responseId: 'r1', correct: false })
    const result = selectWeakest([r])
    expect(result).toEqual({ responseId: 'r1', question: r.question })
  })

  it('returns null when only correct responses exist', () => {
    const r = makeResponse({ responseId: 'r1', correct: true })
    expect(selectWeakest([r])).toBeNull()
  })

  it('picks the response with lowest confidence among incorrect ones', () => {
    const high = makeResponse({ responseId: 'high', correct: false, confidence: 4 })
    const low = makeResponse({ responseId: 'low', correct: false, confidence: 1 })
    const mid = makeResponse({ responseId: 'mid', correct: false, confidence: 3 })
    const result = selectWeakest([high, low, mid])
    expect(result?.responseId).toBe('low')
  })

  it('breaks confidence tie by earliest createdAt', () => {
    const later = makeResponse({
      responseId: 'later',
      correct: false,
      confidence: 2,
      createdAt: new Date('2024-01-01T11:00:00Z'),
    })
    const earlier = makeResponse({
      responseId: 'earlier',
      correct: false,
      confidence: 2,
      createdAt: new Date('2024-01-01T09:00:00Z'),
    })
    const result = selectWeakest([later, earlier])
    expect(result?.responseId).toBe('earlier')
  })

  it('only considers incorrect responses, ignoring correct ones', () => {
    const correct = makeResponse({ responseId: 'c1', correct: true, confidence: 1 })
    const incorrect = makeResponse({ responseId: 'i1', correct: false, confidence: 5 })
    const result = selectWeakest([correct, incorrect])
    expect(result?.responseId).toBe('i1')
  })
})

describe('selectStrongest', () => {
  it('returns null for empty array', () => {
    expect(selectStrongest([])).toBeNull()
  })

  it('returns the single correct response', () => {
    const r = makeResponse({ responseId: 'r1', correct: true })
    const result = selectStrongest([r])
    expect(result).toEqual({ responseId: 'r1', question: r.question })
  })

  it('returns null when only incorrect responses exist', () => {
    const r = makeResponse({ responseId: 'r1', correct: false })
    expect(selectStrongest([r])).toBeNull()
  })

  it('picks the response with highest confidence among correct ones', () => {
    const low = makeResponse({ responseId: 'low', correct: true, confidence: 2 })
    const high = makeResponse({ responseId: 'high', correct: true, confidence: 5 })
    const mid = makeResponse({ responseId: 'mid', correct: true, confidence: 3 })
    const result = selectStrongest([low, high, mid])
    expect(result?.responseId).toBe('high')
  })

  it('breaks confidence tie by fastest timeTakenMs (ascending)', () => {
    const slow = makeResponse({ responseId: 'slow', correct: true, confidence: 5, timeTakenMs: 10000 })
    const fast = makeResponse({ responseId: 'fast', correct: true, confidence: 5, timeTakenMs: 2000 })
    const result = selectStrongest([slow, fast])
    expect(result?.responseId).toBe('fast')
  })

  it('only considers correct responses, ignoring incorrect ones', () => {
    const incorrect = makeResponse({ responseId: 'i1', correct: false, confidence: 5 })
    const correct = makeResponse({ responseId: 'c1', correct: true, confidence: 1 })
    const result = selectStrongest([incorrect, correct])
    expect(result?.responseId).toBe('c1')
  })
})

describe('selectNextFocus', () => {
  it('returns null for empty array', () => {
    expect(selectNextFocus([])).toBeNull()
  })

  it('returns the single weak area', () => {
    const wa: WeakAreaScore = { domain: 'networking', score: 40 }
    expect(selectNextFocus([wa])).toEqual({ domain: 'networking' })
  })

  it('picks the weak area with the lowest score', () => {
    const areas: WeakAreaScore[] = [
      { domain: 'compute', score: 70 },
      { domain: 'networking', score: 30 },
      { domain: 'security', score: 55 },
    ]
    expect(selectNextFocus(areas)).toEqual({ domain: 'networking' })
  })

  it('breaks score tie by domain name alphabetically', () => {
    const areas: WeakAreaScore[] = [
      { domain: 'storage', score: 40 },
      { domain: 'compute', score: 40 },
      { domain: 'networking', score: 40 },
    ]
    expect(selectNextFocus(areas)).toEqual({ domain: 'compute' })
  })
})
