import { describe, expect, it } from 'vitest'
import { gradeReviewItemRequestSchema, LEITNER_EASY_PROMOTION_DEFAULT, reviewGrades } from './index'

describe('reviewGrades', () => {
  it('contains exactly the four expected grades', () => {
    expect(reviewGrades).toEqual(['again', 'hard', 'good', 'easy'])
  })
})

describe('gradeReviewItemRequestSchema', () => {
  it.each(['again', 'hard', 'good', 'easy'] as const)('accepts valid grade "%s"', (grade) => {
    expect(gradeReviewItemRequestSchema.safeParse({ grade }).success).toBe(true)
  })

  it('rejects an invalid grade', () => {
    expect(gradeReviewItemRequestSchema.safeParse({ grade: 'sometimes' }).success).toBe(false)
  })

  it('rejects a missing grade', () => {
    expect(gradeReviewItemRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('LEITNER_EASY_PROMOTION_DEFAULT', () => {
  it('equals 2', () => {
    expect(LEITNER_EASY_PROMOTION_DEFAULT).toBe(2)
  })
})
