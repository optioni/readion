import type { SessionDefaults, UserProfileResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { type ComputedRef, computed } from 'vue'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import {
  type OnboardingDecision,
  resolveOnboardingRoute,
} from '~/composables/resolveOnboardingRoute'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'

export const readProfileEnvelope = (response: { data: unknown }): UserProfileResponse =>
  (response.data as { data: UserProfileResponse }).data

export function useOnboardingGate() {
  const profileQuery = useQuery({
    queryKey: onboardingQueryKeys.profile(),
    queryFn: async (): Promise<UserProfileResponse> =>
      readProfileEnvelope(await usersControllerGetMe()),
  })

  const certificationsQuery = useQuery({
    queryKey: onboardingQueryKeys.certifications(),
    queryFn: async () => {
      const response = await certificationsControllerList()
      return response.data.data
    },
  })

  const enrollmentsQuery = useQuery({
    queryKey: onboardingQueryKeys.enrollments(),
    queryFn: async () => {
      const response = await userCertificationsControllerList({ status: 'active' })
      return response.data.data
    },
  })

  const isLoading = computed(
    () =>
      profileQuery.isLoading.value ||
      certificationsQuery.isLoading.value ||
      enrollmentsQuery.isLoading.value,
  )

  const isError = computed(
    () =>
      profileQuery.isError.value ||
      certificationsQuery.isError.value ||
      enrollmentsQuery.isError.value,
  )

  const sessionDefaults = computed<SessionDefaults | null>(
    () => profileQuery.data.value?.sessionDefaults ?? null,
  )

  const decision: ComputedRef<OnboardingDecision | null> = computed(() => {
    const profile = profileQuery.data.value
    const certs = certificationsQuery.data.value
    const enrollments = enrollmentsQuery.data.value

    if (!profile || !certs || !enrollments) {
      return null
    }

    return resolveOnboardingRoute({ certs, role: profile.role, enrollments })
  })

  return { decision, isLoading, isError, sessionDefaults }
}
