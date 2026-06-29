import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '~/stores/auth'

type RouteLocation = { path: string }

async function importMiddleware() {
  const mod = await import('~/middleware/auth.global')
  return mod.default as (to: RouteLocation, from: RouteLocation) => Promise<unknown>
}

async function runMiddleware(_auth: ReturnType<typeof useAuthStore>, to: RouteLocation) {
  let redirected: unknown = null
  vi.stubGlobal('navigateTo', (dest: unknown) => {
    redirected = dest
    return dest
  })
  const middleware = await importMiddleware()
  await middleware(to, { path: '/other' })
  return redirected
}

describe('auth global middleware', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('redirects unauthenticated user from protected route to /login with redirect param', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/dashboard' })
    expect(result).toMatchObject({ path: '/login', query: { redirect: '/dashboard' } })
  })

  it('redirects unauthenticated user from /settings to /login with redirect param', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/settings' })
    expect(result).toMatchObject({ path: '/login', query: { redirect: '/settings' } })
  })

  it('redirects authenticated user from /login to home', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', null)
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/login' })
    expect(result).toBe('/')
  })

  it('allows unauthenticated access to /register', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/register' })
    expect(result).toBeNull()
  })

  it('allows unauthenticated access to /forgot-password', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/forgot-password' })
    expect(result).toBeNull()
  })

  it('allows unauthenticated access to /verify-email', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/verify-email' })
    expect(result).toBeNull()
  })

  it('allows unauthenticated access to /reset-password', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware(auth, { path: '/reset-password' })
    expect(result).toBeNull()
  })

  it('awaits the bootstrap ready promise before deciding', async () => {
    const auth = useAuthStore()
    // Do NOT call markReady yet

    let resolved = false
    const middlewarePromise = runMiddleware(auth, { path: '/dashboard' }).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    auth.markReady()
    await middlewarePromise
    expect(resolved).toBe(true)
  })
})
