import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReadionFetch, ReadionProblemDetailsError } from '~/api/mutator'

describe('Readion fetch mutator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefixes requests with the API base URL and includes credentials', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
    const readionFetch = createReadionFetch({
      apiBaseUrl: 'http://localhost:3001/api/v1',
    })

    const response = await readionFetch<{
      data: { data: { ok: boolean } }
      status: number
      headers: Headers
    }>('/health', { method: 'GET' })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/health',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    )
    expect(response).toMatchObject({
      data: { data: { ok: true } },
      status: 200,
    })
  })

  it('maps problem-details responses to a typed error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://readion.dev/problems/validation-error',
          title: 'Validation failed',
          status: 422,
          detail: 'Request body is invalid.',
          errors: [{ path: 'email', message: 'Invalid email' }],
        }),
        {
          status: 422,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    )
    const readionFetch = createReadionFetch({
      apiBaseUrl: 'http://localhost:3001/api/v1',
    })

    try {
      await readionFetch('/users', { method: 'POST' })
      throw new Error('Expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ReadionProblemDetailsError)
      expect(error).toMatchObject({
        status: 422,
        title: 'Validation failed',
        detail: 'Request body is invalid.',
        errors: [{ path: 'email', message: 'Invalid email' }],
      })
    }
  })

  it('adds an Authorization header when a future auth layer provides an access token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
    const readionFetch = createReadionFetch({
      apiBaseUrl: 'http://localhost:3001/api/v1',
      getAccessToken: () => 'access-token',
    })

    await readionFetch('/health', { method: 'GET' })

    const headers = fetchMock.mock.calls[0]?.[1]?.headers
    expect(headers).toBeInstanceOf(Headers)
    expect((headers as Headers).get('Authorization')).toBe('Bearer access-token')
  })
})
