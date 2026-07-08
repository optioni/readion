import type { MockExamDomainBreakdown, MockExamQuestionResponse } from '@readion/shared'

export function deriveExamCounts(
  breakdown: MockExamDomainBreakdown,
  questions: MockExamQuestionResponse[],
): { correct: number; incorrect: number; unanswered: number } {
  const stats = Object.values(breakdown ?? {})
  const correct = stats.reduce((sum, stat) => sum + stat.correct, 0)
  const total = stats.reduce((sum, stat) => sum + stat.total, 0)
  const unanswered = questions.filter((question) => question.userAnswer == null).length
  const incorrect = Math.max(0, total - correct - unanswered)
  return { correct, incorrect, unanswered }
}

export function passingScorePercent(raw: number | null | undefined): number | null {
  if (raw == null) {
    return null
  }
  return raw > 100 ? Math.round(raw / 10) : Math.round(raw)
}

export function weightPercent(raw: number): number {
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
}
