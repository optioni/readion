import { chronologicalByStartedAt, isCompletedSession } from '~/composables/sessionSummaryHelpers'
import type {
  ReadinessResponseDto,
  SessionResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'

export interface ReadinessTrend {
  points: number[]
  hasData: boolean
}

const EMPTY_TREND: ReadinessTrend = { points: [], hasData: false }

export function useReadinessTrend(
  sessions: SessionResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
  currentReadiness: ReadinessResponseDto,
): ReadinessTrend {
  if (!currentReadiness.calibrated || currentReadiness.score === null) {
    return EMPTY_TREND
  }

  const completedChronological = sessions.filter(isCompletedSession).sort(chronologicalByStartedAt)

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
