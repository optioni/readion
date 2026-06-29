import type { MockExamResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { fetchMockExam } from '~/composables/mockExamApi'
import { mockExamQueryKeys } from '~/composables/mockExamQueryKeys'

const PREPARING_POLL_MS = 1500

export function useMockExamAttempt(id: string) {
  const query = useQuery({
    queryKey: mockExamQueryKeys.detail(id),
    queryFn: () => fetchMockExam(id),
    // Stream-in is polling, not SSE: poll only while the server is still generating questions and stop
    // the instant `generation` flips to `ready` (or the attempt is terminal).
    refetchInterval: (q) => (q.state.data?.generation === 'preparing' ? PREPARING_POLL_MS : false),
  })

  const exam = computed<MockExamResponse | null>(() => query.data.value ?? null)
  const isLoading = computed(() => query.isLoading.value)
  const isError = computed(() => query.isError.value)

  return { query, exam, isLoading, isError }
}
