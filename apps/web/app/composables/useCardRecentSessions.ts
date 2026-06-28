import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

const RECENT_SESSIONS_LIMIT = 3

export interface RecentSessionEntry {
  id: string
  date: string
  label: string
  accuracy: number | null
}

interface RecentSessionsData {
  sessions: RecentSessionEntry[]
  readinessDelta: number | null
}

const isCompleted = (session: SessionResponseDto) => String(session.status) === 'completed'

async function fetchSummaries(
  sessions: SessionResponseDto[],
): Promise<Map<string, SessionSummaryResponseDto>> {
  const completed = sessions.filter(isCompleted).slice(0, RECENT_SESSIONS_LIMIT)
  const results = await Promise.all(
    completed.map(async (session) => {
      try {
        const response = await sessionSummaryControllerSummary(session.id)
        if (response.status !== 200) {
          return null
        }
        return [session.id, response.data.data] as const
      } catch {
        return null
      }
    }),
  )

  return new Map(
    results.filter((entry): entry is [string, SessionSummaryResponseDto] => entry !== null),
  )
}

export function useCardRecentSessions(enrollmentId: string, certificationId: string) {
  const query = useQuery({
    queryKey: ['dashboard', 'recent-sessions', enrollmentId, certificationId],
    queryFn: async (): Promise<RecentSessionsData> => {
      const response = await sessionsControllerList({
        certificationId,
        limit: RECENT_SESSIONS_LIMIT,
      })
      const sessionRows = response.data.data
      const summaries = await fetchSummaries(sessionRows)

      const sessions = sessionRows.map<RecentSessionEntry>((session) => {
        const summary = summaries.get(session.id)
        return {
          id: session.id,
          date: session.startedAt,
          label: String(session.focusArea),
          accuracy: summary ? summary.accuracy : null,
        }
      })

      const latestCompleted = sessionRows.find((session) => summaries.has(session.id))
      const delta = latestCompleted ? summaries.get(latestCompleted.id)?.readiness.delta : null

      return {
        sessions,
        readinessDelta: delta == null ? null : Number(delta),
      }
    },
  })

  const sessions = computed<RecentSessionEntry[]>(() => query.data.value?.sessions ?? [])
  const readinessDelta = computed<number | null>(() => query.data.value?.readinessDelta ?? null)

  return { sessions, readinessDelta, isLoading: query.isLoading, isError: query.isError }
}
