import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import { recentSessionLabel } from '~/composables/recentSessionLabel'
import {
  fetchRecentSessionSummaries,
  RECENT_SESSIONS_LIMIT,
} from '~/composables/recentSessionSummaries'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'
import type { SessionSummaryResponseDtoNextFocus } from '~~/src/api/model'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

interface OverviewSessionsData {
  sessions: RecentSessionEntry[]
  totalSessions: number
  nextFocusDomain: string | null
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
        return {
          id: session.id,
          date: session.startedAt,
          label: recentSessionLabel(session),
          accuracy: summary ? summary.accuracy : null,
        }
      })

      const latestCompleted = sessionRows.find((session) => summaries.has(session.id))
      const nextFocusDomain = latestCompleted
        ? readNextFocusDomain(summaries.get(latestCompleted.id)?.nextFocus)
        : null

      return { sessions, totalSessions: response.data.meta.total, nextFocusDomain }
    },
  })

  const sessions = computed<RecentSessionEntry[]>(() => query.data.value?.sessions ?? [])
  const totalSessions = computed<number>(() => query.data.value?.totalSessions ?? 0)
  const nextFocusDomain = computed<string | null>(() => query.data.value?.nextFocusDomain ?? null)

  return {
    sessions,
    totalSessions,
    nextFocusDomain,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
