import type { ReadinessResponseDto, SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

export interface ReadinessTrend {
  points: number[]
  hasData: boolean
}

const EMPTY_TREND: ReadinessTrend = { points: [], hasData: false }

const isCompleted = (session: SessionResponseDto) => String(session.status) === 'completed'

const chronological = (a: SessionResponseDto, b: SessionResponseDto) =>
  a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0

export function useReadinessTrend(
  sessions: SessionResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
  currentReadiness: ReadinessResponseDto,
): ReadinessTrend {
  if (!currentReadiness.calibrated || currentReadiness.score === null) {
    return EMPTY_TREND
  }

  const completedChronological = sessions.filter(isCompleted).sort(chronological)

  const summaryPoints: number[] = []
  for (const session of completedChronological) {
    const summary = summaries.get(session.id)
    if (!summary) {
      continue
    }
    const after = summary.readiness.after
    if (typeof after === 'number') {
      summaryPoints.push(after)
    }
  }

  return {
    points: [...summaryPoints, currentReadiness.score],
    hasData: true,
  }
}
