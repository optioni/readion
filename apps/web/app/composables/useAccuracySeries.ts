import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

export interface AccuracyPoint {
  sessionId: string
  accuracy: number
}

const isCompleted = (session: SessionResponseDto) => String(session.status) === 'completed'

const chronological = (a: SessionResponseDto, b: SessionResponseDto) =>
  a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0

export function useAccuracySeries(
  sessions: SessionResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
): AccuracyPoint[] {
  return sessions
    .filter(isCompleted)
    .sort(chronological)
    .flatMap((session) => {
      const summary = summaries.get(session.id)
      if (!summary) {
        return []
      }
      return [{ sessionId: session.id, accuracy: summary.accuracy }]
    })
}
