import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { readinessControllerRead } from '~~/src/api/readiness/readiness'

export interface CardReadiness {
  calibrated: boolean
  score: number | null
  trajectory: { weeksToReady: number } | null
}

const PLACEHOLDER_READINESS: CardReadiness = {
  calibrated: false,
  score: null,
  trajectory: null,
}

export function useCardReadiness(enrollmentId: string) {
  const query = useQuery({
    queryKey: ['dashboard', 'readiness', enrollmentId],
    queryFn: async () => {
      const response = await readinessControllerRead(enrollmentId)
      return response.data.data
    },
  })

  const readiness = computed<CardReadiness>(() => {
    const data = query.data.value
    if (!data) {
      return PLACEHOLDER_READINESS
    }

    return {
      calibrated: data.calibrated,
      score: data.score,
      trajectory: data.trajectory,
    }
  })

  return { readiness, isLoading: query.isLoading, isError: query.isError }
}
