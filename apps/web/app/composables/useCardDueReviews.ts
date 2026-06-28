import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { readionFetch } from '~/api/mutator'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { getEnrollmentReviewControllerQueueUrl } from '~~/src/api/enrollment-review/enrollment-review'

interface ReviewQueueResponse {
  items: unknown[]
  meta: { dueCount: number; total: number }
}

type ReviewQueueResult = {
  data: ReviewQueueResponse
  status: number
  headers: Headers
}

export function useCardDueReviews(enrollmentId: string) {
  const query = useQuery({
    queryKey: dashboardQueryKeys.dueReviews(enrollmentId),
    queryFn: async () => {
      const response = await readionFetch<ReviewQueueResult>(
        getEnrollmentReviewControllerQueueUrl(enrollmentId),
      )
      return response.data.meta.dueCount
    },
  })

  const dueCount = computed<number>(() => query.data.value ?? 0)

  return { dueCount, isLoading: query.isLoading, isError: query.isError }
}
