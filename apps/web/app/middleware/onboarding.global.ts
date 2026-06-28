import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { ADMIN_CERT_SETUP_ROUTE } from '~/composables/onboardingRoutes'
import { resolveOnboardingRoute } from '~/composables/resolveOnboardingRoute'
import { readProfileEnvelope } from '~/composables/useOnboardingGate'
import { readionQueryClient } from '~/lib/vue-query'
import { useAuthStore } from '~/stores/auth'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path !== '/' && to.path !== '/onboarding') return

  const auth = useAuthStore()
  await auth.ready
  if (!auth.isAuthenticated) return

  const profile = await readionQueryClient.ensureQueryData({
    queryKey: onboardingQueryKeys.profile(),
    queryFn: async () => readProfileEnvelope(await usersControllerGetMe()),
  })
  const certs = await readionQueryClient.ensureQueryData({
    queryKey: onboardingQueryKeys.certifications(),
    queryFn: async () => (await certificationsControllerList()).data.data,
  })
  const enrollments = await readionQueryClient.ensureQueryData({
    queryKey: onboardingQueryKeys.enrollments(),
    queryFn: async () => (await userCertificationsControllerList({ status: 'active' })).data.data,
  })

  const decision = resolveOnboardingRoute({ certs, role: profile.role, enrollments })

  switch (decision.kind) {
    case 'admin-cert-setup':
      return navigateTo(ADMIN_CERT_SETUP_ROUTE)
    case 'onboarding':
    case 'no-certs':
      if (to.path !== '/onboarding') return navigateTo('/onboarding')
      return
    default:
      if (to.path !== '/') return navigateTo('/', { replace: true })
      return
  }
})
