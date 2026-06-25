import { describe, expect, it } from 'vitest'
import { computeDomainScore } from './domain-scoring'

describe('computeDomainScore', () => {
  it('all-correct confident answers score higher than all-correct unsure answers', () => {
    const confidentCorrect = computeDomainScore([
      { correct: true, confidence: 5 },
      { correct: true, confidence: 5 },
    ])
    const unsureCorrect = computeDomainScore([
      { correct: true, confidence: 1 },
      { correct: true, confidence: 1 },
    ])
    expect(confidentCorrect.score).toBeGreaterThan(unsureCorrect.score)
  })

  it('confident-wrong answers depress the score more than unsure-wrong', () => {
    const confidentWrong = computeDomainScore([
      { correct: false, confidence: 5 },
      { correct: false, confidence: 5 },
    ])
    const unsureWrong = computeDomainScore([
      { correct: false, confidence: 1 },
      { correct: false, confidence: 1 },
    ])
    expect(confidentWrong.score).toBeLessThan(unsureWrong.score)
  })

  it('output is bounded 0–100', () => {
    const extremeCorrect = computeDomainScore([{ correct: true, confidence: 5 }])
    const extremeWrong = computeDomainScore([{ correct: false, confidence: 5 }])
    const mixed = computeDomainScore([
      { correct: true, confidence: 3 },
      { correct: false, confidence: 3 },
    ])

    expect(extremeCorrect.score).toBeLessThanOrEqual(100)
    expect(extremeCorrect.score).toBeGreaterThanOrEqual(0)
    expect(extremeWrong.score).toBeGreaterThanOrEqual(0)
    expect(mixed.score).toBeGreaterThanOrEqual(0)
    expect(mixed.score).toBeLessThanOrEqual(100)
  })

  it('accuracy is the fraction of correct answers', () => {
    const result = computeDomainScore([
      { correct: true, confidence: 3 },
      { correct: true, confidence: 3 },
      { correct: false, confidence: 3 },
    ])
    expect(result.accuracy).toBeCloseTo(2 / 3, 5)
  })

  it('meanConfidence is the average confidence', () => {
    const result = computeDomainScore([
      { correct: true, confidence: 2 },
      { correct: false, confidence: 4 },
    ])
    expect(result.meanConfidence).toBeCloseTo(3, 5)
  })

  it('responseCount matches the number of responses', () => {
    const result = computeDomainScore([
      { correct: true, confidence: 3 },
      { correct: false, confidence: 2 },
      { correct: true, confidence: 5 },
    ])
    expect(result.responseCount).toBe(3)
  })

  it('empty responses returns all-zero result', () => {
    const result = computeDomainScore([])
    expect(result.score).toBe(0)
    expect(result.accuracy).toBe(0)
    expect(result.meanConfidence).toBe(0)
    expect(result.responseCount).toBe(0)
  })
})
