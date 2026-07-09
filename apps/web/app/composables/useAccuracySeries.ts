import { friendlyDate } from '~/composables/friendlyDate'
import { chronologicalByStartedAt, isCompletedSession } from '~/composables/sessionSummaryHelpers'
import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

export interface AccuracyPoint {
  sessionId: string
  accuracy: number
  label: string
}

export function useAccuracySeries(
  sessions: SessionResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
): AccuracyPoint[] {
  return sessions
    .filter(isCompletedSession)
    .sort(chronologicalByStartedAt)
    .flatMap((session) => {
      const summary = summaries.get(session.id)
      if (!summary) {
        return []
      }
      return [
        { sessionId: session.id, accuracy: summary.accuracy, label: friendlyDate(session.startedAt) },
      ]
    })
}
