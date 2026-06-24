import { useAuthStore } from '~/stores/auth'

const PUBLIC_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/reset-password',
])

const postLoginRedirect = (intendedPath: string) => ({
  path: '/login',
  query: { redirect: intendedPath },
})

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  await auth.ready

  if (PUBLIC_ROUTES.has(to.path)) {
    if (auth.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
      return navigateTo('/')
    }
    return
  }

  if (!auth.isAuthenticated) {
    return navigateTo(postLoginRedirect(to.path))
  }
})
