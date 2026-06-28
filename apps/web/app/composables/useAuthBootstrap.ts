import { getCsrfTokenFromCookie } from '~/api/mutator'
import type { AuthUser } from '~/stores/auth'

type RefreshResponse = { data?: { accessToken?: string } }
type MeResponse = { data?: AuthUser }

export async function runAuthBootstrap(auth: {
  setSession: (token: string, user: AuthUser | null) => void
  setUser: (user: AuthUser) => void
  markReady: () => void
  user: AuthUser | null
}) {
  const runtimeConfig = useRuntimeConfig()
  const apiBase = runtimeConfig.public.apiBaseUrl.replace(/\/$/, '')

  try {
    const csrfToken = getCsrfTokenFromCookie()
    const refreshRes = await fetch(`${apiBase}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      ...(csrfToken ? { headers: { 'x-csrf-token': csrfToken } } : {}),
    })

    if (!refreshRes.ok) {
      return
    }

    const refreshBody = (await refreshRes.json()) as RefreshResponse
    const accessToken = refreshBody.data?.accessToken

    if (!accessToken) {
      return
    }

    auth.setSession(accessToken, null)

    const meRes = await fetch(`${apiBase}/api/v1/users/me`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (meRes.ok) {
      const meBody = (await meRes.json()) as MeResponse
      if (meBody.data) {
        auth.setUser(meBody.data)
      }
    }
  } catch {
    // Network failure — stay unauthenticated
  } finally {
    auth.markReady()
  }
}
