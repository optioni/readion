import { Injectable } from '@nestjs/common'
import { ScrapperError } from './scrapper.errors'

export interface ScrapperResult {
  content: string
  url: string
}

// The scrapper's article-extraction endpoint. The service root ("/") only
// serves the web UI, so hitting it returns the SPA HTML for every url; the
// readable page text lives behind /api/article as JSON.
export function buildScrapperUrl(baseUrl: string, targetUrl: string): string {
  const request = new URL('/api/article', baseUrl)
  request.searchParams.set('url', targetUrl)
  return request.toString()
}

export function mapResponseError(targetUrl: string, status: number): never {
  throw new ScrapperError(targetUrl, status)
}

// /api/article returns the Readability result as JSON; textContent is the plain
// reading text. Fall back to the raw body if the response is not the expected
// JSON, so an unexpected shape degrades to "something" rather than throwing.
function extractArticleText(body: string): string {
  try {
    const parsed = JSON.parse(body) as { textContent?: string | null }
    return parsed.textContent ?? ''
  } catch {
    return body
  }
}

@Injectable()
export class ScrapperClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(baseUrl: string, timeoutMs = 30_000) {
    this.baseUrl = baseUrl
    this.timeoutMs = timeoutMs
  }

  async fetch(targetUrl: string): Promise<ScrapperResult> {
    const requestUrl = buildScrapperUrl(this.baseUrl, targetUrl)

    let response: Response
    try {
      response = await globalThis.fetch(requestUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (cause) {
      throw new ScrapperError(targetUrl, undefined, cause)
    }

    if (!response.ok) {
      mapResponseError(targetUrl, response.status)
    }

    const content = extractArticleText(await response.text())
    return { content, url: targetUrl }
  }
}
