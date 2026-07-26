import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, toValue } from 'vue'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import type { SessionResponseDto } from '~~/src/api/model'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

export interface SessionHistoryRow {
  id: string
  date: string
  kind: string
  focusArea: string
  durationMinutes: number
  status: string
  accuracy: number | null
}

interface SessionsHistoryData {
  rows: SessionHistoryRow[]
  total: number
}

const isCompleted = (session: SessionResponseDto) => String(session.status) === 'completed'

export function useSessionsHistory(
  certificationId: MaybeRefOrGetter<string | null>,
  pagination: { page: Ref<number>; limit: Ref<number> },
) {
  const queryClient = useQueryClient()
  const { page, limit } = pagination

  // The summary fan-out is bounded to the rows on the visible page and cached per session id, so
  // paging back to a visited page resolves from cache without re-hitting the summary endpoint.
  const accuracyFor = async (sessionId: string): Promise<number | null> =>
    queryClient.fetchQuery({
      queryKey: certDetailQueryKeys.sessionSummary(sessionId),
      staleTime: Number.POSITIVE_INFINITY,
      queryFn: async () => {
        try {
          const response = await sessionSummaryControllerSummary(sessionId)
          if (response.status !== 200) {
            return null
          }
          return response.data.data.accuracy
        } catch {
          return null
        }
      },
    })

  const query = useQuery({
    queryKey: computed(() =>
      certDetailQueryKeys.sessions(toValue(certificationId) ?? '', page.value, limit.value),
    ),
    enabled: computed(() => toValue(certificationId) !== null),
    queryFn: async (): Promise<SessionsHistoryData> => {
      const response = await sessionsControllerList({
        certificationId: toValue(certificationId) as string,
        page: page.value,
        limit: limit.value,
      })
      const sessionRows = response.data.data

      const accuracies = new Map<string, number | null>(
        await Promise.all(
          sessionRows
            .filter(isCompleted)
            .map(async (session) => [session.id, await accuracyFor(session.id)] as const),
        ),
      )

      const rows = sessionRows.map<SessionHistoryRow>((session) => ({
        id: session.id,
        date: session.startedAt,
        kind: String(session.kind),
        focusArea: String(session.focusArea),
        durationMinutes: session.durationMinutes,
        status: String(session.status),
        accuracy: accuracies.get(session.id) ?? null,
      }))

      return { rows, total: response.data.meta.total }
    },
  })

  const rows = computed<SessionHistoryRow[]>(() => query.data.value?.rows ?? [])
  const total = computed<number>(() => query.data.value?.total ?? 0)

  async function retry() {
    await query.refetch()
  }

  return {
    rows,
    total,
    page,
    limit,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    retry,
  } as {
    rows: typeof rows
    total: typeof total
    page: typeof page
    limit: typeof limit
    isLoading: typeof query.isLoading
    isError: typeof query.isError
    isFetching?: typeof query.isFetching
    retry?: typeof retry
  }
}
