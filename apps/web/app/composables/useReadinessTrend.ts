import { friendlyDate } from '~/composables/friendlyDate'
import { chronologicalByStartedAt, isCompletedSession } from '~/composables/sessionSummaryHelpers'
import type {
  ReadinessResponseDto,
  SessionResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'

export interface ReadinessTrendPoint {
  score: number
  label: string
}

export interface ReadinessTrend {
  points: ReadinessTrendPoint[]
  hasData: boolean
}

const EMPTY_TREND: ReadinessTrend = { points: [], hasData: false }

export function useReadinessTrend(
  sessions: SessionResponseDto[],
  summaries: Map<string, SessionSummaryResponseDto>,
  currentReadiness: ReadinessResponseDto,
  now: Date = new Date(),
): ReadinessTrend {
  if (!currentReadiness.calibrated || currentReadiness.score === null) {
    return EMPTY_TREND
  }

  const completedChronological = sessions.filter(isCompletedSession).sort(chronologicalByStartedAt)

  const summaryPoints: ReadinessTrendPoint[] = []
  for (const session of completedChronological) {
    const summary = summaries.get(session.id)
    if (!summary) {
      continue
    }
    const after = summary.readiness.after
    if (typeof after === 'number') {
      summaryPoints.push({ score: after, label: friendlyDate(session.startedAt) })
    }
  }

  return {
    points: [
      ...summaryPoints,
      { score: currentReadiness.score, label: friendlyDate(now.toISOString(), now) },
    ],
    hasData: true,
  }
}
