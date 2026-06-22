import { Injectable } from '@nestjs/common'
import { ScrapperError } from './scrapper.errors'

export interface ScrapperResult {
  content: string
  url: string
}

export function buildScrapperUrl(baseUrl: string, targetUrl: string): string {
  const request = new URL('/', baseUrl)
  request.searchParams.set('url', targetUrl)
  return request.toString()
}

export function mapResponseError(targetUrl: string, status: number): never {
  throw new ScrapperError(targetUrl, status)
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

    const content = await response.text()
    return { content, url: targetUrl }
  }
}
