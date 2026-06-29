import { useAuthStore } from '~/stores/auth'

// Non-global guard applied to /admin/** pages. auth.global.ts already enforces generic
// authentication; this layers the admin-role check on top and bounces non-admins to /.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  await auth.ready

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.path } })
  }

  if (auth.user?.role !== 'admin') {
    return navigateTo('/')
  }
})
