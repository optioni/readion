import type { MockExamDomainBreakdown, MockExamQuestionResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { deriveExamCounts, passingScorePercent, weightPercent } from '~/composables/mockExamResults'

const DOMAIN_BREAKDOWN: MockExamDomainBreakdown = {
  'Resilient Architectures': { correct: 14, total: 18, accuracy: 0.78 },
  'Secure Architectures': { correct: 11, total: 16, accuracy: 0.69 },
  'High-Performing Architectures': { correct: 12, total: 16, accuracy: 0.75 },
  'Cost-Optimized Architectures': { correct: 9, total: 15, accuracy: 0.6 },
}

function buildQuestions(): MockExamQuestionResponse[] {
  const questions: MockExamQuestionResponse[] = []
  for (let i = 0; i < 65; i += 1) {
    const isUnanswered = i >= 61
    const isWrong = i === 0
    questions.push({
      id: `q-${i}`,
      question: `Question ${i}`,
      options: ['a', 'b'],
      domain: 'Resilient Architectures',
      userAnswer: isUnanswered ? null : isWrong ? 'wrong' : 'a',
    })
  }
  return questions
}

describe('deriveExamCounts', () => {
  it('derives correct/incorrect/unanswered from the e2e-shaped fixture', () => {
    expect(deriveExamCounts(DOMAIN_BREAKDOWN, buildQuestions())).toEqual({
      correct: 46,
      incorrect: 15,
      unanswered: 4,
    })
  })

  it('returns zeros for an empty breakdown', () => {
    expect(deriveExamCounts({}, [])).toEqual({ correct: 0, incorrect: 0, unanswered: 0 })
  })
})

describe('passingScorePercent', () => {
  it('maps a 0-1000 scale value down to a percentage', () => {
    expect(passingScorePercent(700)).toBe(70)
  })

  it('leaves an already-percentage value unchanged', () => {
    expect(passingScorePercent(72)).toBe(72)
  })

  it('returns null for null or undefined', () => {
    expect(passingScorePercent(null)).toBeNull()
    expect(passingScorePercent(undefined)).toBeNull()
  })
})

describe('weightPercent', () => {
  it('scales a 0-1 fraction up to a percentage', () => {
    expect(weightPercent(0.2)).toBe(20)
  })

  it('leaves an already-percentage value unchanged', () => {
    expect(weightPercent(25)).toBe(25)
  })
})
