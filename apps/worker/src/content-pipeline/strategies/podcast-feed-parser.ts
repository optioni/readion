import Parser from 'rss-parser'
import type { FetchedContent } from './fetch-strategy.interface'

interface PodcastFeedItem {
  title?: string
  link?: string
  guid?: string
  content?: string
  contentSnippet?: string
  itunesSummary?: string
  transcript?: string | { _?: string }
}

const podcastFeedParser = new Parser<Record<string, never>, PodcastFeedItem>({
  customFields: {
    item: [
      ['podcast:transcript', 'transcript'],
      ['itunes:summary', 'itunesSummary'],
    ],
  },
})

function extractText(value: string | { _?: string } | undefined): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (value && typeof value._ === 'string') {
    const trimmed = value._.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  return undefined
}

function resolveEpisodeText(item: PodcastFeedItem): string | undefined {
  return (
    extractText(item.transcript) ??
    extractText(item.itunesSummary) ??
    extractText(item.content) ??
    extractText(item.contentSnippet)
  )
}

function resolveEpisodeUrl(item: PodcastFeedItem, feedUrl: string): string {
  return item.link ?? item.guid ?? feedUrl
}

export async function parsePodcastFeed(xml: string, feedUrl: string): Promise<FetchedContent[]> {
  const feed = await podcastFeedParser.parseString(xml)

  const results: FetchedContent[] = []
  for (const item of feed.items) {
    const text = resolveEpisodeText(item)
    if (!text) continue
    results.push({ text, url: resolveEpisodeUrl(item, feedUrl) })
  }
  return results
}
