import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReadionFetch, ReadionProblemDetailsError } from '~/api/mutator'
import { useAuthStore } from '~/stores/auth'

const BASE_URL = 'http://localhost:3001/api/v1'

function ok200(body: unknown = { data: {} }) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function problemResponse(status: number, title: string) {
  return new Response(JSON.stringify({ title, status }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

describe('Readion fetch mutator — 401 refresh-and-retry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries with the new token after a successful silent refresh', async () => {
    const auth = useAuthStore()
    auth.setSession('old-token', null)

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(problemResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(ok200({ data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(ok200({ data: { ok: true } }))

    const onRefresh = vi.fn((newToken: string) => {
      auth.setSession(newToken, null)
    })
    const readionFetch = createReadionFetch({
      apiBaseUrl: BASE_URL,
      getAccessToken: () => auth.accessToken,
      onRefreshToken: onRefresh,
    })

    const result = await readionFetch('/protected', { method: 'GET' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onRefresh).toHaveBeenCalledWith('new-token')
    const calls = fetchMock.mock.calls
    expect((calls[2]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer new-token')
    expect(result).toMatchObject({ data: { data: { ok: true } } })
  })

  it('clears the store and surfaces the 401 when refresh also fails', async () => {
    const auth = useAuthStore()
    auth.setSession('old-token', null)

    const clearMock = vi.spyOn(auth, 'clear')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(problemResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(problemResponse(401, 'Unauthorized'))

    const readionFetch = createReadionFetch({
      apiBaseUrl: BASE_URL,
      getAccessToken: () => auth.accessToken,
      onRefreshToken: vi.fn(),
      onRefreshFailed: () => auth.clear(),
    })

    await expect(readionFetch('/protected', { method: 'GET' })).rejects.toBeInstanceOf(
      ReadionProblemDetailsError,
    )
    expect(clearMock).toHaveBeenCalledOnce()
  })

  it('does not retry more than once on 401', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', null)

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(problemResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(ok200({ data: { accessToken: 'new' } }))
      .mockResolvedValueOnce(problemResponse(401, 'Still unauthorized'))

    const readionFetch = createReadionFetch({
      apiBaseUrl: BASE_URL,
      getAccessToken: () => auth.accessToken,
      onRefreshToken: (t) => {
        auth.setSession(t, null)
      },
      onRefreshFailed: () => auth.clear(),
    })

    await expect(readionFetch('/protected', { method: 'GET' })).rejects.toBeInstanceOf(
      ReadionProblemDetailsError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('concurrent 401s share one in-flight refresh', async () => {
    const auth = useAuthStore()
    auth.setSession('tok', null)

    let refreshCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('/auth/refresh')) {
        refreshCount++
        return ok200({ data: { accessToken: 'refreshed' } })
      }
      if (auth.accessToken === 'tok') {
        return problemResponse(401, 'Unauthorized')
      }
      return ok200({ data: { done: true } })
    })

    const readionFetch = createReadionFetch({
      apiBaseUrl: BASE_URL,
      getAccessToken: () => auth.accessToken,
      onRefreshToken: (t) => {
        auth.setSession(t, null)
      },
      onRefreshFailed: () => auth.clear(),
    })

    await Promise.all([
      readionFetch('/a', { method: 'GET' }),
      readionFetch('/b', { method: 'GET' }),
      readionFetch('/c', { method: 'GET' }),
    ])

    expect(refreshCount).toBe(1)
  })
})
