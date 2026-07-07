import { afterEach, describe, expect, it, vi } from 'vitest'
import { TavilySearchClient } from './tavily-search.client'

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response
}

describe('TavilySearchClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the query to Tavily with bearer auth and returns the results', async () => {
    const results = [{ title: 'AWS', url: 'https://aws.amazon.com', content: 'Guide' }]
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ results }))

    const client = new TavilySearchClient()
    const returned = await client.search('aws certified cloud practitioner', {
      apiKey: 'tvly-test-key',
      maxResults: 5,
    })

    expect(returned).toEqual(results)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.tavily.com/search')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tvly-test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'aws certified cloud practitioner',
      max_results: 5,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws when the provider responds with a non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }))

    const client = new TavilySearchClient()

    await expect(
      client.search('kubernetes', { apiKey: 'tvly-test-key', maxResults: 8 }),
    ).rejects.toThrow(/503/)
  })
})
