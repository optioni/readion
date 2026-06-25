import { Injectable } from '@nestjs/common'
import { extractDomain, throttleForDomain, USER_AGENT } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

interface RedditPost {
  data: {
    title: string
    selftext: string
    url: string
    comments?: RedditComment[]
  }
}

interface RedditComment {
  data: { body: string; replies?: { data: { children: RedditComment[] } } }
}

@Injectable()
export class RedditFetchStrategy implements FetchStrategy {
  async fetch(url: string): Promise<FetchedContent[]> {
    const jsonUrl = url.replace(/\/?$/, '.json')
    await throttleForDomain(extractDomain(jsonUrl))
    const response = await globalThis.fetch(jsonUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) return []
    const json = await response.json()
    return this.extractContent(json as unknown[][], url)
  }

  private extractContent(data: unknown[][], sourceUrl: string): FetchedContent[] {
    const results: FetchedContent[] = []
    const listing = data[0] as unknown as { data: { children: RedditPost[] } } | undefined
    if (!listing) return results

    for (const post of listing.data.children) {
      const text = [post.data.title, post.data.selftext].filter(Boolean).join('\n\n')
      if (text.trim()) {
        results.push({ text, url: sourceUrl })
      }
    }

    return results
  }
}
