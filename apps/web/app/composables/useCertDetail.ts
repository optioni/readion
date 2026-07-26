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
  const questionCount = computed(() => certificationQuery.data.value?.questionCount ?? null)
  const passingScore = computed(() => certificationQuery.data.value?.passingScore ?? null)

  const isLoading = computed(() => {
    if (enrollmentQuery.isLoading.value) {
      return true
    }
    return certificationId.value !== null && certificationQuery.isLoading.value
  })

  const isError = computed(
    () => (enrollmentQuery.isError.value && !notFound.value) || certificationQuery.isError.value,
  )
  const isFetching = computed(
    () => enrollmentQuery.isFetching.value || certificationQuery.isFetching.value,
  )

  async function retry() {
    await enrollmentQuery.refetch()
    if (certificationId.value !== null) {
      await certificationQuery.refetch()
    }
  }

  return {
    name,
    provider,
    code,
    certificationId,
    domains,
    questionCount,
    passingScore,
    isLoading,
    isError,
    isFetching,
    retry,
    notFound,
  } as {
    name: typeof name
    provider: typeof provider
    code: typeof code
    certificationId: typeof certificationId
    domains: typeof domains
    questionCount: typeof questionCount
    passingScore: typeof passingScore
    isLoading: typeof isLoading
    isError: typeof isError
    isFetching?: typeof isFetching
    retry?: typeof retry
    notFound: typeof notFound
  }
}
