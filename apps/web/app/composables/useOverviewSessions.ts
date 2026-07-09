import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import type { SessionFocusAreaEntry } from '~/composables/lastStudiedAt'
import { recentSessionLabel } from '~/composables/recentSessionLabel'
import {
  fetchRecentSessionSummaries,
  RECENT_SESSIONS_LIMIT,
} from '~/composables/recentSessionSummaries'
import { aggregateSessionStats } from '~/composables/sessionStatsAggregate'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'
import type {
  SessionSummaryResponseDto,
  SessionSummaryResponseDtoNextFocus,
} from '~~/src/api/model'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

interface OverviewSessionsData {
  sessions: RecentSessionEntry[]
  totalSessions: number
  nextFocusDomain: string | null
  questionsAnswered: number
  accuracy: number | null
  latestSummary: SessionSummaryResponseDto | null
  sessionFocusAreas: SessionFocusAreaEntry[]
}

const readNextFocusDomain = (
  nextFocus: SessionSummaryResponseDtoNextFocus | undefined,
): string | null => {
  const domain = nextFocus?.domain
  return typeof domain === 'string' ? domain : null
}

export function useOverviewSessions(certificationId: MaybeRefOrGetter<string | null>) {
  const query = useQuery({
    queryKey: computed(() => certDetailQueryKeys.overviewSessions(toValue(certificationId) ?? '')),
    enabled: computed(() => toValue(certificationId) !== null),
    queryFn: async (): Promise<OverviewSessionsData> => {
      const response = await sessionsControllerList({
        certificationId: toValue(certificationId) as string,
        limit: RECENT_SESSIONS_LIMIT,
      })
      const sessionRows = response.data.data
      const summaries = await fetchRecentSessionSummaries(sessionRows)

      const sessions = sessionRows.map<RecentSessionEntry>((session) => {
        const summary = summaries.get(session.id)
        const delta = summary?.readiness.delta
        return {
          id: session.id,
          date: session.startedAt,
          label: recentSessionLabel(session),
          accuracy: summary ? summary.accuracy : null,
          durationMinutes: session.durationMinutes ?? null,
          delta: delta == null ? null : Number(delta),
          kind: String(session.kind),
        }
      })

      const latestCompleted = sessionRows.find((session) => summaries.has(session.id))
      const latestSummary = latestCompleted ? (summaries.get(latestCompleted.id) ?? null) : null
      const nextFocusDomain = readNextFocusDomain(latestSummary?.nextFocus)

      const { questionsAnswered, accuracy } = aggregateSessionStats(summaries)

      const sessionFocusAreas = sessionRows.map<SessionFocusAreaEntry>((session) => ({
        startedAt: session.startedAt,
        focusArea: session.focusArea,
      }))

      return {
        sessions,
        totalSessions: response.data.meta.total,
        nextFocusDomain,
        questionsAnswered,
        accuracy,
        latestSummary,
        sessionFocusAreas,
      }
    },
  })

  const sessions = computed<RecentSessionEntry[]>(() => query.data.value?.sessions ?? [])
  const totalSessions = computed<number>(() => query.data.value?.totalSessions ?? 0)
  const nextFocusDomain = computed<string | null>(() => query.data.value?.nextFocusDomain ?? null)
  const questionsAnswered = computed<number>(() => query.data.value?.questionsAnswered ?? 0)
  const accuracy = computed<number | null>(() => query.data.value?.accuracy ?? null)
  const latestSummary = computed<SessionSummaryResponseDto | null>(
    () => query.data.value?.latestSummary ?? null,
  )
  const sessionFocusAreas = computed<SessionFocusAreaEntry[]>(
    () => query.data.value?.sessionFocusAreas ?? [],
  )

  return {
    sessions,
    totalSessions,
    nextFocusDomain,
    questionsAnswered,
    accuracy,
    latestSummary,
    sessionFocusAreas,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
