import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { readionFetch } from '~/api/mutator'
import { progressQueryKeys } from '~/composables/progressQueryKeys'
import { getEnrollmentReviewControllerQueueUrl } from '~~/src/api/enrollment-review/enrollment-review'

interface ReviewQueueResponse {
  items: unknown[]
  meta: { dueCount: number; total: number; suppressedDomains: string[] }
}

type ReviewQueueResult = {
  data: ReviewQueueResponse
  status: number
  headers: Headers
}

// Reads the same /review endpoint as useCardDueReviews (and the same progressQueryKeys.reviewQueue
// cache key ProgressDomainRow already invalidates after a successful suppress-domain mutation) so
// the mastered state is derived from a fresh fetch instead of a client-only ref that resets on
// reload (fix-web-learner-surfaces-parity 6.1).
export function useSuppressedDomains(enrollmentId: string) {
  const query = useQuery({
    queryKey: progressQueryKeys.reviewQueue(enrollmentId),
    queryFn: async () => {
      const response = await readionFetch<ReviewQueueResult>(
        getEnrollmentReviewControllerQueueUrl(enrollmentId),
      )
      return response.data.meta.suppressedDomains
    },
  })

  const suppressedDomains = computed<string[]>(() => query.data.value ?? [])

  return { suppressedDomains, isLoading: query.isLoading, isError: query.isError }
}
