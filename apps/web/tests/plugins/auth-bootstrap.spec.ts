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

describe('auth bootstrap (server)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const userBody = () =>
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
    )

  async function runServerBootstrap(
    auth: ReturnType<typeof useAuthStore>,
    options: {
      cookieHeader: string | undefined
      forwardSetCookie?: (cookies: string[]) => void
    },
  ) {
    const { runAuthBootstrapServer } = await import('~/composables/useAuthBootstrap')
    await runAuthBootstrapServer(auth, {
      apiBase: 'http://localhost:3001',
      cookieHeader: options.cookieHeader,
      forwardSetCookie: options.forwardSetCookie ?? (() => {}),
    })
  }

  it('forwards the request cookie and CSRF header to refresh, then hydrates the session', async () => {
    const rotated = new Headers()
    rotated.append('set-cookie', 'refresh_token=R2; Path=/; HttpOnly; Secure; SameSite=Lax')
    rotated.append('set-cookie', 'csrf_token=C2; Path=/; Domain=readion.app; Secure; SameSite=Lax')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { accessToken: 'ssr-tok' } }), {
          status: 200,
          headers: rotated,
        }),
      )
      .mockResolvedValueOnce(userBody())

    const auth = useAuthStore()
    await runServerBootstrap(auth, { cookieHeader: 'refresh_token=R1; csrf_token=C1' })

    const refreshInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    const refreshHeaders = new Headers(refreshInit.headers)
    expect(refreshHeaders.get('cookie')).toBe('refresh_token=R1; csrf_token=C1')
    expect(refreshHeaders.get('x-csrf-token')).toBe('C1')
    expect(auth.accessToken).toBe('ssr-tok')
    expect(auth.user?.email).toBe('a@b.com')
  })

  it('propagates the rotated Set-Cookie headers back to the browser response', async () => {
    const rotatedCookies = [
      'refresh_token=R2; Path=/; HttpOnly',
      'csrf_token=C2; Path=/; Domain=readion.app',
    ]
    const refreshResponse = {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => rotatedCookies },
      json: async () => ({ data: { accessToken: 'ssr-tok' } }),
    } as unknown as Response
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(userBody())

    const forwarded: string[] = []
    const auth = useAuthStore()
    await runServerBootstrap(auth, {
      cookieHeader: 'refresh_token=R1; csrf_token=C1',
      forwardSetCookie: (cookies) => forwarded.push(...cookies),
    })

    expect(forwarded).toEqual([
      'refresh_token=R2; Path=/; HttpOnly',
      'csrf_token=C2; Path=/; Domain=readion.app',
    ])
  })

  it('does not hit the network when no refresh cookie is present', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const auth = useAuthStore()

    await runServerBootstrap(auth, { cookieHeader: 'unrelated=1' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('stays unauthenticated when the forwarded refresh is rejected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ title: 'Forbidden', status: 403 }), { status: 403 }),
    )
    const auth = useAuthStore()

    await runServerBootstrap(auth, { cookieHeader: 'refresh_token=R1; csrf_token=C1' })

    expect(auth.isAuthenticated).toBe(false)
  })
})
