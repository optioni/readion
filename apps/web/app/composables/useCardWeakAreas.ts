import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import type { WeakAreaResponseDto } from '~~/src/api/model'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'

const WEAK_AREAS_LIMIT = 3

export function useCardWeakAreas(enrollmentId: string) {
  const query = useQuery({
    queryKey: dashboardQueryKeys.weakAreas(enrollmentId),
    queryFn: async () => {
      const response = await userCertificationsControllerListWeakAreas(enrollmentId)
      return response.data.data
    },
  })

  const weakAreas = computed<WeakAreaResponseDto[]>(
    () => query.data.value?.slice(0, WEAK_AREAS_LIMIT) ?? [],
  )

  return { weakAreas, isLoading: query.isLoading, isError: query.isError }
}
