import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '~/stores/auth'

describe('auth bootstrap', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { apiBaseUrl: 'http://localhost:3001' },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function runBootstrap(auth: ReturnType<typeof useAuthStore>) {
    const { runAuthBootstrap } = await import('~/composables/useAuthBootstrap')
    await runAuthBootstrap(auth)
  }

  it('calls /auth/refresh then /users/me with correctly-constructed URLs on load', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { accessToken: 'new-tok' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: '1',
              email: 'a@b.com',
              emailVerified: true,
              displayTimezone: 'UTC',
              createdAt: '',
            },
          }),
          { status: 200 },
        ),
      )
    const auth = useAuthStore()
    await runBootstrap(auth)

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toBe('http://localhost:3001/api/v1/auth/refresh')
    expect(urls[1]).toBe('http://localhost:3001/api/v1/users/me')
    for (const url of urls) {
      expect(url).not.toContain('/api/v1/api/v1')
    }
  })

  it('stores the new access token and hydrates user on successful refresh', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { accessToken: 'new-tok' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: '1',
              email: 'a@b.com',
              emailVerified: true,
              displayTimezone: 'UTC',
              createdAt: '',
              role: 'admin',
            },
          }),
          { status: 200 },
        ),
      )
    const auth = useAuthStore()
    await runBootstrap(auth)

    expect(auth.accessToken).toBe('new-tok')
    expect(auth.user?.email).toBe('a@b.com')
    expect(auth.user?.role).toBe('admin')
    expect(auth.isAuthenticated).toBe(true)
  })

  it('leaves the store unauthenticated when refresh returns 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )
    const auth = useAuthStore()
    await runBootstrap(auth)

    expect(auth.accessToken).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('resolves the store ready promise whether refresh succeeds or fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )
    const auth = useAuthStore()
    const readyResolved = vi.fn()
    auth.ready.then(readyResolved)

    await runBootstrap(auth)
    await Promise.resolve()

    expect(readyResolved).toHaveBeenCalled()
  })
})
