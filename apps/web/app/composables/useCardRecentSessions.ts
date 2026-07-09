import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { recentSessionLabel } from '~/composables/recentSessionLabel'
import {
  fetchRecentSessionSummaries,
  RECENT_SESSIONS_LIMIT,
} from '~/composables/recentSessionSummaries'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

export interface RecentSessionEntry {
  id: string
  date: string
  label: string
  accuracy: number | null
  durationMinutes: number | null
  /** Per-session readiness delta (from the session summary), when the caller supplies it. */
  delta?: number | null
  /** Session kind (e.g. "study" | "mock"), when the caller supplies it. */
  kind?: string
}

interface RecentSessionsData {
  sessions: RecentSessionEntry[]
  readinessDelta: number | null
}

export function useCardRecentSessions(enrollmentId: string, certificationId: string) {
  const query = useQuery({
    queryKey: dashboardQueryKeys.recentSessions(enrollmentId, certificationId),
    queryFn: async (): Promise<RecentSessionsData> => {
      const response = await sessionsControllerList({
        certificationId,
        limit: RECENT_SESSIONS_LIMIT,
      })
      const sessionRows = response.data.data
      const summaries = await fetchRecentSessionSummaries(sessionRows)

      const sessions = sessionRows.map<RecentSessionEntry>((session) => {
        const summary = summaries.get(session.id)
        return {
          id: session.id,
          date: session.startedAt,
          label: recentSessionLabel(session),
          accuracy: summary ? summary.accuracy : null,
          durationMinutes: session.durationMinutes ?? null,
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
