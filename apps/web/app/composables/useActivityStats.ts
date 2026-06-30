import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

export interface ActivityStats {
  sessionCount: number
  questionsAnswered: number
  studyTimeLabel: string
  currentStreakDays: number
}

function formatStudyTime(totalMinutes: number): string {
  if (totalMinutes === 0) {
    return '0m'
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

function toCalendarDay(isoString: string): string {
  return isoString.slice(0, 10)
}

function computeStreak(sessions: SessionResponseDto[]): number {
  if (sessions.length === 0) {
    return 0
  }

  const days = [...new Set(sessions.map((s) => toCalendarDay(s.startedAt)))].sort((a, b) =>
    a > b ? -1 : a < b ? 1 : 0,
  )

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] as string)
    const curr = new Date(days[i] as string)
    const diffMs = prev.getTime() - curr.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function useActivityStats(
  sessions: SessionResponseDto[],
  summariesMap: Map<string, SessionSummaryResponseDto>,
): ActivityStats {
  const sessionCount = sessions.length

  const questionsAnswered = sessions.reduce((sum, s) => {
    const summary = summariesMap.get(s.id)
    return sum + (summary?.questionsAnswered ?? 0)
  }, 0)

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
  const studyTimeLabel = formatStudyTime(totalMinutes)

  const currentStreakDays = computeStreak(sessions)

  return { sessionCount, questionsAnswered, studyTimeLabel, currentStreakDays }
}
