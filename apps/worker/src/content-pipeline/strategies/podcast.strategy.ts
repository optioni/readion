import { Injectable } from '@nestjs/common'
import { extractDomain, throttleForDomain, USER_AGENT } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'
import { parsePodcastFeed } from './podcast-feed-parser'

@Injectable()
export class PodcastFetchStrategy implements FetchStrategy {
  async fetch(url: string): Promise<FetchedContent[]> {
    try {
      await throttleForDomain(extractDomain(url))
      const response = await globalThis.fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) return []

      const xml = await response.text()
      return await parsePodcastFeed(xml, url)
    } catch {
      return []
    }
  }
}
