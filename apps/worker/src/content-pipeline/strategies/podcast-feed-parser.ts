import Parser from 'rss-parser'

export interface PodcastEpisode {
  url: string
  transcriptUrl?: string
  fallbackText?: string
}

interface PodcastTranscriptAttributes {
  url?: string
  type?: string
}

interface PodcastFeedItem {
  title?: string
  link?: string
  guid?: string
  content?: string
  contentSnippet?: string
  itunesSummary?: string
  transcript?: string | { _?: string; $?: PodcastTranscriptAttributes }
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

function resolveTranscriptUrl(item: PodcastFeedItem): string | undefined {
  if (typeof item.transcript === 'string' || !item.transcript) return undefined
  const url = item.transcript.$?.url
  return url && url.trim().length > 0 ? url : undefined
}

function resolveFallbackText(item: PodcastFeedItem): string | undefined {
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

export async function parsePodcastFeed(xml: string, feedUrl: string): Promise<PodcastEpisode[]> {
  const feed = await podcastFeedParser.parseString(xml)

  return feed.items.map((item) => ({
    url: resolveEpisodeUrl(item, feedUrl),
    transcriptUrl: resolveTranscriptUrl(item),
    fallbackText: resolveFallbackText(item),
  }))
}
