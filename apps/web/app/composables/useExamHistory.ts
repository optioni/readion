import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import { enrollmentMockExamControllerList } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import type { MockExamResponseDto } from '~~/src/api/model'

export interface ExamHistoryRow {
  id: string
  date: string | null
  type: string
  status: string
  score: number | null
  passed: boolean | null
}

const toRow = (attempt: MockExamResponseDto): ExamHistoryRow => ({
  id: attempt.id,
  date: typeof attempt.startedAt === 'string' ? attempt.startedAt : null,
  type: String(attempt.type),
  status: String(attempt.status),
  score: typeof attempt.score === 'number' ? attempt.score : null,
  passed: typeof attempt.passed === 'boolean' ? attempt.passed : null,
})

export function useExamHistory(enrollmentId: string) {
  const query = useQuery({
    queryKey: certDetailQueryKeys.mockExams(enrollmentId),
    queryFn: async (): Promise<ExamHistoryRow[]> => {
      const response = await enrollmentMockExamControllerList(enrollmentId)
      if (response.status !== 200) {
        return []
      }
      return response.data.data.map(toRow)
    },
  })

  const rows = computed<ExamHistoryRow[]>(() => query.data.value ?? [])

  async function retry() {
    await query.refetch()
  }

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    retry,
  } as {
    rows: typeof rows
    isLoading: typeof query.isLoading
    isError: typeof query.isError
    isFetching?: typeof query.isFetching
    retry?: typeof retry
  }
}
