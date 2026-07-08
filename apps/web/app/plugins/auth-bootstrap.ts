import { runAuthBootstrap, runAuthBootstrapServer } from '~/composables/useAuthBootstrap'
import { resolveApiBaseUrl } from '~/config/api-base-url'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  const apiBase = resolveApiBaseUrl(useRuntimeConfig())

  if (import.meta.server) {
    const event = useRequestEvent()
    const cookieHeader = useRequestHeaders(['cookie']).cookie
    return runAuthBootstrapServer(auth, {
      apiBase,
      cookieHeader,
      forwardSetCookie: (cookies) => {
        if (!event) return
        for (const cookie of cookies) {
          appendResponseHeader(event, 'set-cookie', cookie)
        }
      },
    })
  }

  // The session was already refreshed on the server and hydrated from the payload —
  // re-running refresh here would rotate the single-use token a second time for nothing.
  if (auth.isAuthenticated) {
    auth.markReady()
    return
  }

  return runAuthBootstrap(auth)
})
