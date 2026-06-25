import { Injectable } from '@nestjs/common'
import { YoutubeTranscript } from 'youtube-transcript'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v')
    }
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1)
    }
  } catch {
    // ignore
  }
  return null
}

@Injectable()
export class YouTubeFetchStrategy implements FetchStrategy {
  async fetch(url: string): Promise<FetchedContent[]> {
    const videoId = extractVideoId(url)
    if (!videoId) return []

    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    return segments.map((segment) => ({
      text: segment.text,
      url,
      metadata: { startOffsetSeconds: segment.offset / 1000 },
    }))
  }
}
