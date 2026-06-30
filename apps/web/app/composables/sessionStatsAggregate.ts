import type { SessionSummaryResponseDto } from '~~/src/api/model'

export interface AggregatedSessionStats {
  questionsAnswered: number
  accuracy: number | null
}

export function aggregateSessionStats(
  summaries: Map<string, SessionSummaryResponseDto>,
): AggregatedSessionStats {
  const values = [...summaries.values()]
  const questionsAnswered = values.reduce((sum, summary) => sum + summary.questionsAnswered, 0)

  if (values.length === 0) {
    return { questionsAnswered, accuracy: null }
  }

  const accuracy = values.reduce((sum, summary) => sum + summary.accuracy, 0) / values.length
  return { questionsAnswered, accuracy }
}
