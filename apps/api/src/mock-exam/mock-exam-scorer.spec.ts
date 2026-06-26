import type { CertificationDomain } from '@readion/shared'
import type { MockExamQuestion } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { MockExamScorer } from './mock-exam-scorer'

function makeQuestion(
  id: string,
  domain: string,
  correctAnswer: string,
  selectedAnswer: string | null,
): MockExamQuestion {
  return {
    id,
    question: `Question ${id}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer,
    explanation: `Explanation ${id}`,
    selectedAnswer,
    domain,
    provenance: {
      sourceChunkIds: [],
      supportingSpans: [],
      verdict: { pass: true, score: 1.0, distractorFindings: [] },
      score: 1.0,
    },
  }
}

const DOMAINS: CertificationDomain[] = [
  { name: 'Security', weight: 50 },
  { name: 'Networking', weight: 50 },
]

describe('MockExamScorer', () => {
  const scorer = new MockExamScorer()

  describe('overall score (correct / total)', () => {
    it('returns 1 when all questions answered correctly', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'),
        makeQuestion('q2', 'Networking', 'Option B', 'Option B'),
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.score).toBe(1)
    })

    it('returns 0 when all questions answered incorrectly', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option B'),
        makeQuestion('q2', 'Networking', 'Option B', 'Option C'),
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.score).toBe(0)
    })

    it('returns fraction matching correct / total', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', 'Option C'), // incorrect
        makeQuestion('q3', 'Networking', 'Option A', 'Option A'), // correct
        makeQuestion('q4', 'Networking', 'Option B', 'Option D'), // incorrect
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.score).toBe(0.5)
    })
  })

  describe('unanswered questions count as incorrect', () => {
    it('treats null selectedAnswer as incorrect for overall score', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', null), // unanswered → incorrect
        makeQuestion('q3', 'Networking', 'Option A', null), // unanswered → incorrect
        makeQuestion('q4', 'Networking', 'Option B', null), // unanswered → incorrect
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.score).toBe(0.25) // 1 correct / 4 total
    })

    it('counts unanswered questions as incorrect in domain breakdown', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', null), // unanswered → incorrect
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      const secDomain = result.domainBreakdown['Security']
      expect(secDomain).toBeDefined()
      expect(secDomain!.correct).toBe(1)
      expect(secDomain!.total).toBe(2)
    })
  })

  describe('pass/fail determination', () => {
    it('passes when score equals passing score exactly (boundary: inclusive >=)', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', 'Option B'), // correct
        makeQuestion('q3', 'Networking', 'Option A', 'Option A'), // correct
        makeQuestion('q4', 'Networking', 'Option B', null), // incorrect
      ]
      // score = 3/4 = 0.75, passingScore = 0.75 → should PASS (>= is inclusive)
      const result = scorer.score(questions, DOMAINS, 0.75)
      expect(result.score).toBe(0.75)
      expect(result.passed).toBe(true)
    })

    it('passes when score exceeds passing score', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'),
        makeQuestion('q2', 'Networking', 'Option B', 'Option B'),
      ]
      // score = 1.0 > 0.7 → pass
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.passed).toBe(true)
    })

    it('fails when score is below passing score', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', null), // unanswered
        makeQuestion('q3', 'Networking', 'Option A', null), // unanswered
        makeQuestion('q4', 'Networking', 'Option B', null), // unanswered
      ]
      // score = 1/4 = 0.25 < 0.7 → fail
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.passed).toBe(false)
    })

    it('fails when score is just below passing score', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', 'Option B'), // correct
        makeQuestion('q3', 'Networking', 'Option A', null), // unanswered
        makeQuestion('q4', 'Networking', 'Option B', null), // unanswered
      ]
      // score = 2/4 = 0.5 < 0.7 → fail
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.passed).toBe(false)
    })
  })

  describe('domain breakdown', () => {
    it('keys the breakdown by each question domain', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', 'Option C'), // incorrect
        makeQuestion('q3', 'Networking', 'Option A', 'Option A'), // correct
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)
      expect(result.domainBreakdown).toHaveProperty('Security')
      expect(result.domainBreakdown).toHaveProperty('Networking')
    })

    it('computes correct/total/accuracy per domain', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'), // correct
        makeQuestion('q2', 'Security', 'Option B', 'Option C'), // incorrect
        makeQuestion('q3', 'Networking', 'Option A', 'Option A'), // correct
        makeQuestion('q4', 'Networking', 'Option B', 'Option B'), // correct
      ]
      const result = scorer.score(questions, DOMAINS, 0.7)

      expect(result.domainBreakdown['Security']).toEqual({
        correct: 1,
        total: 2,
        accuracy: 0.5,
      })
      expect(result.domainBreakdown['Networking']).toEqual({
        correct: 2,
        total: 2,
        accuracy: 1,
      })
    })

    it('includes cert domains with zero questions as empty stats', () => {
      const domainsWithExtra: CertificationDomain[] = [
        { name: 'Security', weight: 40 },
        { name: 'Networking', weight: 40 },
        { name: 'Compute', weight: 20 },
      ]
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'),
      ]
      const result = scorer.score(questions, domainsWithExtra, 0.7)
      // Compute domain appears even with 0 questions
      expect(result.domainBreakdown).toHaveProperty('Compute')
      expect(result.domainBreakdown['Compute']).toEqual({
        correct: 0,
        total: 0,
        accuracy: 0,
      })
    })

    it('is deterministic — same inputs always produce same outputs', () => {
      const questions = [
        makeQuestion('q1', 'Security', 'Option A', 'Option A'),
        makeQuestion('q2', 'Security', 'Option B', null),
        makeQuestion('q3', 'Networking', 'Option C', 'Option C'),
      ]
      const r1 = scorer.score(questions, DOMAINS, 0.7)
      const r2 = scorer.score(questions, DOMAINS, 0.7)
      expect(r1).toEqual(r2)
    })
  })
})
