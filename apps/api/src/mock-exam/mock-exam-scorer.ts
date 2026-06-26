import { Injectable } from '@nestjs/common'
import type { CertificationDomain } from '@readion/shared'
import type { MockExamDomainBreakdown, MockExamQuestion } from '@readion/shared'

export interface ScoreResult {
  score: number
  passed: boolean
  domainBreakdown: MockExamDomainBreakdown
}

@Injectable()
export class MockExamScorer {
  /**
   * Scores a mock exam attempt.
   *
   * - score: fraction 0..1 = (correct answers) / (total questions)
   * - passed: score >= passingScore (inclusive; real cert semantics)
   * - unanswered questions (selectedAnswer === null) count as incorrect
   * - passingScore must be in the same 0..1 fraction scale as score;
   *   callers normalise Certification.passingScore (0-1000 scale) by dividing by 1000
   * - domainWeights pre-seeds the breakdown so all cert domains appear,
   *   even if no questions were allocated to that domain
   */
  score(
    questions: MockExamQuestion[],
    domainWeights: CertificationDomain[],
    passingScore: number,
  ): ScoreResult {
    const domainBreakdown = this.buildBreakdown(questions, domainWeights)
    const totalQuestions = questions.length
    const correctAnswers = questions.filter(
      (q) => q.selectedAnswer !== null && q.selectedAnswer === q.correctAnswer,
    ).length

    const computedScore = totalQuestions === 0 ? 0 : correctAnswers / totalQuestions

    return {
      score: computedScore,
      passed: computedScore >= passingScore,
      domainBreakdown,
    }
  }

  private buildBreakdown(
    questions: MockExamQuestion[],
    domainWeights: CertificationDomain[],
  ): MockExamDomainBreakdown {
    const breakdown: MockExamDomainBreakdown = {}

    for (const { name } of domainWeights) {
      breakdown[name] = { correct: 0, total: 0, accuracy: 0 }
    }

    for (const question of questions) {
      const domain = question.domain
      if (!breakdown[domain]) {
        breakdown[domain] = { correct: 0, total: 0, accuracy: 0 }
      }

      const stat = breakdown[domain]!
      stat.total += 1

      if (question.selectedAnswer !== null && question.selectedAnswer === question.correctAnswer) {
        stat.correct += 1
      }

      stat.accuracy = stat.total === 0 ? 0 : stat.correct / stat.total
    }

    return breakdown
  }
}
