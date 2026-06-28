import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import type { WeakAreaResponseDto } from '~~/src/api/model'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'

export function useCertWeakAreas(enrollmentId: string) {
  const query = useQuery({
    queryKey: certDetailQueryKeys.weakAreas(enrollmentId),
    queryFn: async () => {
      const response = await userCertificationsControllerListWeakAreas(enrollmentId)
      return response.data.data
    },
  })

  const weakAreas = computed<WeakAreaResponseDto[]>(() => query.data.value ?? [])

  return { weakAreas, isLoading: query.isLoading, isError: query.isError }
}
