import { Injectable } from '@nestjs/common'
import { extractDomain, throttleForDomain, USER_AGENT } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'
import { type PodcastEpisode, parsePodcastFeed } from './podcast-feed-parser'

@Injectable()
export class PodcastFetchStrategy implements FetchStrategy {
  async fetch(url: string): Promise<FetchedContent[]> {
    try {
      await throttleForDomain(extractDomain(url))
      const response = await globalThis.fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) return []

      const xml = await response.text()
      const episodes = await parsePodcastFeed(xml, url)

      const results: FetchedContent[] = []
      for (const episode of episodes) {
        const text = await this.resolveEpisodeText(episode)
        if (!text) continue
        results.push({ text, url: episode.url })
      }
      return results
    } catch {
      return []
    }
  }

  private async resolveEpisodeText(episode: PodcastEpisode): Promise<string | undefined> {
    if (episode.transcriptUrl) {
      const transcript = await this.fetchTranscript(episode.transcriptUrl)
      if (transcript) return transcript
    }
    return episode.fallbackText
  }

  private async fetchTranscript(transcriptUrl: string): Promise<string | undefined> {
    try {
      await throttleForDomain(extractDomain(transcriptUrl))
      const response = await globalThis.fetch(transcriptUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) return undefined
      const text = await response.text()
      const trimmed = text.trim()
      return trimmed.length > 0 ? trimmed : undefined
    } catch {
      return undefined
    }
  }
}
