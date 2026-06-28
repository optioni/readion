import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { certDetailQueryKeys } from '~/composables/certDetailQueryKeys'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerDetail } from '~~/src/api/user-certifications/user-certifications'

export function useCertDetail(enrollmentId: string) {
  const enrollmentQuery = useQuery({
    queryKey: certDetailQueryKeys.enrollment(enrollmentId),
    queryFn: async () => {
      const response = await userCertificationsControllerDetail(enrollmentId, {
        include: 'weakAreas',
      })
      return response.data.data
    },
    retry: false,
  })

  const certificationId = computed(() => enrollmentQuery.data.value?.certificationId ?? null)

  const certificationQuery = useQuery({
    queryKey: computed(() => certDetailQueryKeys.certification(certificationId.value ?? '')),
    queryFn: async () => {
      const response = await certificationsControllerDetail(certificationId.value as string)
      return response.data.data
    },
    enabled: computed(() => certificationId.value !== null),
  })

  const notFound = computed(() => {
    const error = enrollmentQuery.error.value
    return error instanceof ReadionProblemDetailsError && error.status === 404
  })

  const name = computed(() => certificationQuery.data.value?.name ?? '')
  const provider = computed(() => certificationQuery.data.value?.provider ?? '')
  const code = computed(() => certificationQuery.data.value?.code ?? '')
  const domains = computed(() => certificationQuery.data.value?.domains ?? [])

  const isLoading = computed(() => {
    if (enrollmentQuery.isLoading.value) {
      return true
    }
    return certificationId.value !== null && certificationQuery.isLoading.value
  })

  const isError = computed(
    () => (enrollmentQuery.isError.value && !notFound.value) || certificationQuery.isError.value,
  )

  return { name, provider, code, certificationId, domains, isLoading, isError, notFound }
}
