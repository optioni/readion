import { getCsrfTokenFromCookie } from '~/api/mutator'
import type { AuthUser } from '~/stores/auth'

type RefreshResponse = { data?: { accessToken?: string } }
type MeResponse = { data?: AuthUser }

type AuthBootstrapTarget = {
  setSession: (token: string, user: AuthUser | null) => void
  setUser: (user: AuthUser) => void
  markReady: () => void
}

const CSRF_COOKIE_NAME = 'csrf_token'
const REFRESH_COOKIE_NAME = 'refresh_token'

const readCookieValue = (cookieHeader: string, name: string): string | null => {
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return match ? match.slice(name.length + 1) : null
}

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

// SSR-side bootstrap: refresh using the browser's forwarded cookie so the server render
// knows the user is authenticated and skips the login redirect. Refresh tokens are single-use,
// so the rotated Set-Cookie headers from the API MUST be propagated back to the browser —
// otherwise the token the API just invalidated would still be in the browser and the next
// refresh would fail.
export async function runAuthBootstrapServer(
  auth: AuthBootstrapTarget,
  options: {
    apiBase: string
    cookieHeader: string | undefined
    forwardSetCookie: (cookies: string[]) => void
  },
) {
  const apiBase = options.apiBase.replace(/\/$/, '')
  const cookieHeader = options.cookieHeader

  try {
    if (cookieHeader === undefined || readCookieValue(cookieHeader, REFRESH_COOKIE_NAME) === null) {
      return
    }

    const csrfToken = readCookieValue(cookieHeader, CSRF_COOKIE_NAME)
    const refreshRes = await fetch(`${apiBase}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
    })

    if (!refreshRes.ok) {
      return
    }

    const rotatedCookies = refreshRes.headers.getSetCookie()
    if (rotatedCookies.length > 0) {
      options.forwardSetCookie(rotatedCookies)
    }

    const refreshBody = (await refreshRes.json()) as RefreshResponse
    const accessToken = refreshBody.data?.accessToken

    if (!accessToken) {
      return
    }

    auth.setSession(accessToken, null)

    const meRes = await fetch(`${apiBase}/api/v1/users/me`, {
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
