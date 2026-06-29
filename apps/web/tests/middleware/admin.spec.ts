import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '~/stores/auth'

type RouteLocation = { path: string }

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  emailVerified: true,
  displayTimezone: 'UTC',
  createdAt: '',
  role: 'admin' as const,
}

async function importMiddleware() {
  const mod = await import('~/middleware/admin')
  return mod.default as (to: RouteLocation, from: RouteLocation) => Promise<unknown>
}

async function runMiddleware(to: RouteLocation) {
  let redirected: unknown = null
  vi.stubGlobal('navigateTo', (dest: unknown) => {
    redirected = dest
    return dest
  })
  const middleware = await importMiddleware()
  await middleware(to, { path: '/other' })
  return redirected
}

describe('admin route middleware', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('allows an admin through without redirecting', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', adminUser)
    auth.markReady()

    const result = await runMiddleware({ path: '/admin/users' })
    expect(result).toBeNull()
  })

  it('redirects a signed-in non-admin to /', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', { ...adminUser, role: 'user' })
    auth.markReady()

    const result = await runMiddleware({ path: '/admin/users' })
    expect(result).toBe('/')
  })

  it('redirects an unauthenticated visitor to login with a redirect query', async () => {
    const auth = useAuthStore()
    auth.markReady()

    const result = await runMiddleware({ path: '/admin/users' })
    expect(result).toEqual({ path: '/login', query: { redirect: '/admin/users' } })
  })

  it('awaits auth.ready before deciding', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', { ...adminUser, role: 'user' })

    let redirected: unknown = 'untouched'
    vi.stubGlobal('navigateTo', (dest: unknown) => {
      redirected = dest
      return dest
    })
    const middleware = await importMiddleware()
    const pending = middleware({ path: '/admin/users' }, { path: '/other' })

    expect(redirected).toBe('untouched')
    auth.markReady()
    await pending
    expect(redirected).toBe('/')
  })
})
