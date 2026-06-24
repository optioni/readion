import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReadionFetch } from '~/api/mutator'
import { useAuthStore } from '~/stores/auth'

const BASE_URL = 'http://localhost:3001/api/v1'

function ok200(body: unknown = { data: {} }) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('Readion fetch mutator — auth extensions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authorization header', () => {
    it('attaches Bearer token when auth store has a token', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
      const auth = useAuthStore()
      auth.setSession('my-access-token', null)
      const readionFetch = createReadionFetch({
        apiBaseUrl: BASE_URL,
        getAccessToken: () => auth.accessToken,
      })

      await readionFetch('/health', { method: 'GET' })

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer my-access-token')
    })

    it('omits Authorization header when store has no token', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
      const auth = useAuthStore()
      const readionFetch = createReadionFetch({
        apiBaseUrl: BASE_URL,
        getAccessToken: () => auth.accessToken,
      })

      await readionFetch('/health', { method: 'GET' })

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
      expect(headers.get('Authorization')).toBeNull()
    })
  })

  describe('CSRF header', () => {
    it('echoes csrf_token cookie into x-csrf-token on POST', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
      Object.defineProperty(document, 'cookie', {
        value: 'csrf_token=csrf-value-123; other=abc',
        configurable: true,
      })
      const readionFetch = createReadionFetch({
        apiBaseUrl: BASE_URL,
        getCsrfToken: () => 'csrf-value-123',
      })

      await readionFetch('/resource', { method: 'POST' })

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
      expect(headers.get('x-csrf-token')).toBe('csrf-value-123')
    })

    it('echoes csrf_token on PUT, PATCH, DELETE', async () => {
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
        const readionFetch = createReadionFetch({ apiBaseUrl: BASE_URL, getCsrfToken: () => 'tok' })
        await readionFetch('/resource', { method })
        const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
        expect(headers.get('x-csrf-token')).toBe('tok')
        vi.restoreAllMocks()
      }
    })

    it('does not add x-csrf-token on GET', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
      const readionFetch = createReadionFetch({ apiBaseUrl: BASE_URL, getCsrfToken: () => 'tok' })

      await readionFetch('/resource', { method: 'GET' })

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
      expect(headers.get('x-csrf-token')).toBeNull()
    })

    it('still sends credentials: include and the configured base URL', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok200())
      const readionFetch = createReadionFetch({ apiBaseUrl: BASE_URL })

      await readionFetch('/health', { method: 'GET' })

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/health`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })
})
