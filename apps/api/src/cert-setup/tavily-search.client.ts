import { Injectable } from '@nestjs/common'

export const CERT_SEARCH_HTTP_CLIENT = Symbol('CERT_SEARCH_HTTP_CLIENT')

export interface TavilyResult {
  title: string
  url: string
  content: string
  score?: number
}

export interface CertSearchHttpClient {
  search(query: string, options: { apiKey: string; maxResults: number }): Promise<TavilyResult[]>
}

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const TAVILY_TIMEOUT_MS = 8_000

interface TavilySearchResponse {
  results: TavilyResult[]
}

@Injectable()
export class TavilySearchClient implements CertSearchHttpClient {
  async search(
    query: string,
    { apiKey, maxResults }: { apiKey: string; maxResults: number },
  ): Promise<TavilyResult[]> {
    const response = await globalThis.fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, max_results: maxResults }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Tavily search failed with status ${response.status}`)
    }

    const payload = (await response.json()) as TavilySearchResponse
    return payload.results
  }
}
