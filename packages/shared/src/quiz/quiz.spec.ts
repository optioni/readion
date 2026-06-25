import { describe, expect, it } from 'vitest'
import {
  generateQuizRequestSchema,
  questionFormats,
  quizDifficulties,
  reportRequestSchema,
  submitAnswerRequestSchema,
} from './index'

describe('quiz shared contracts', () => {
  describe('questionFormats', () => {
    it('contains exactly multiple_choice, true_false, and scenario', () => {
      expect(questionFormats).toContain('multiple_choice')
      expect(questionFormats).toContain('true_false')
      expect(questionFormats).toContain('scenario')
      expect(questionFormats).toHaveLength(3)
    })
  })

  describe('quizDifficulties', () => {
    it('includes beginner, intermediate, advanced, and exam-ready', () => {
      expect(quizDifficulties).toContain('beginner')
      expect(quizDifficulties).toContain('intermediate')
      expect(quizDifficulties).toContain('advanced')
      expect(quizDifficulties).toContain('exam-ready')
    })
  })

  describe('generateQuizRequestSchema', () => {
    it('accepts a valid request with all fields', () => {
      const result = generateQuizRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        domain: 'compute',
        difficulty: 'intermediate',
      })
      expect(result.success).toBe(true)
    })

    it('accepts exam-ready as a valid difficulty', () => {
      const result = generateQuizRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        domain: 'compute',
        difficulty: 'exam-ready',
      })
      expect(result.success).toBe(true)
    })

    it('rejects a missing userCertificationId', () => {
      const result = generateQuizRequestSchema.safeParse({
        domain: 'compute',
        difficulty: 'intermediate',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a non-UUID userCertificationId', () => {
      const result = generateQuizRequestSchema.safeParse({
        userCertificationId: 'not-a-uuid',
        domain: 'compute',
        difficulty: 'intermediate',
      })
      expect(result.success).toBe(false)
    })

    it('rejects an unknown difficulty value', () => {
      const result = generateQuizRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        domain: 'compute',
        difficulty: 'expert',
      })
      expect(result.success).toBe(false)
    })

    it('rejects an empty domain', () => {
      const result = generateQuizRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        domain: '',
        difficulty: 'intermediate',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('submitAnswerRequestSchema', () => {
    it('accepts a valid answer submission', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'Scalable computing capacity',
        confidence: 4,
        timeTakenMs: 12000,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(4)
        expect(result.data.timeTakenMs).toBe(12000)
      }
    })

    it('accepts minimum confidence of 1', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 1,
        timeTakenMs: 0,
      })
      expect(result.success).toBe(true)
    })

    it('accepts maximum confidence of 5', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 5,
        timeTakenMs: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects confidence below 1', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 0,
        timeTakenMs: 1000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects confidence above 5', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 6,
        timeTakenMs: 1000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative timeTakenMs', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 3,
        timeTakenMs: -1,
      })
      expect(result.success).toBe(false)
    })

    it('accepts zero timeTakenMs', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: 'A',
        confidence: 3,
        timeTakenMs: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty answer', () => {
      const result = submitAnswerRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        answer: '',
        confidence: 3,
        timeTakenMs: 1000,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('reportRequestSchema', () => {
    it('accepts a valid report request', () => {
      const result = reportRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'The question is factually incorrect',
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty reason', () => {
      const result = reportRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
        reason: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a missing reason', () => {
      const result = reportRequestSchema.safeParse({
        userCertificationId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(false)
    })
  })
})
