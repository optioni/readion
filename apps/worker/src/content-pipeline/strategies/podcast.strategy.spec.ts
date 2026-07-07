import { afterEach, describe, expect, it, vi } from 'vitest'
import { PodcastFetchStrategy } from './podcast.strategy'

const TRANSCRIPT_URL = 'https://example.com/podcast/ep1-transcript.vtt'
const TRANSCRIPT_BODY =
  'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nFull transcript text for episode one about IAM roles.'

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>AWS Weekly</title>
    <link>https://example.com/podcast</link>
    <item>
      <title>Episode 1: IAM Deep Dive</title>
      <link>https://example.com/podcast/ep1</link>
      <guid>ep-1-guid</guid>
      <description>Show notes for episode 1 without a transcript.</description>
      <podcast:transcript url="${TRANSCRIPT_URL}" type="text/vtt"/>
    </item>
    <item>
      <title>Episode 2: VPC Networking</title>
      <link>https://example.com/podcast/ep2</link>
      <guid>ep-2-guid</guid>
      <itunes:summary>iTunes summary show notes for episode two about VPC networking.</itunes:summary>
      <description>Fallback description for episode two.</description>
    </item>
  </channel>
</rss>`

function stubFetchRouting(routes: {
  feed?: { ok: boolean; body?: string }
  transcript?: { ok?: boolean; body?: string; reject?: boolean }
}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === TRANSCRIPT_URL) {
      if (routes.transcript?.reject) return Promise.reject(new Error('transcript unreachable'))
      return Promise.resolve({
        ok: routes.transcript?.ok ?? true,
        text: () => Promise.resolve(routes.transcript?.body ?? ''),
      })
    }
    return Promise.resolve({
      ok: routes.feed?.ok ?? true,
      text: () => Promise.resolve(routes.feed?.body ?? RSS_FIXTURE),
    })
  })
}

describe('PodcastFetchStrategy', () => {
  let strategy: PodcastFetchStrategy

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the advertised podcast:transcript url and uses its text', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchRouting({
        feed: { ok: true, body: RSS_FIXTURE },
        transcript: { ok: true, body: TRANSCRIPT_BODY },
      }),
    )
    strategy = new PodcastFetchStrategy()

    const results = await strategy.fetch('https://example.com/podcast/feed.xml')

    expect(results.length).toBeGreaterThanOrEqual(2)

    const episodeOne = results.find((r) => r.url === 'https://example.com/podcast/ep1')
    expect(episodeOne).toBeDefined()
    expect(episodeOne?.text).toContain('Full transcript text for episode one about IAM roles.')
  })

  it('falls back to itunes:summary show notes when no transcript is advertised', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchRouting({
        feed: { ok: true, body: RSS_FIXTURE },
        transcript: { ok: true, body: TRANSCRIPT_BODY },
      }),
    )
    strategy = new PodcastFetchStrategy()

    const results = await strategy.fetch('https://example.com/podcast/feed.xml')

    const episodeTwo = results.find((r) => r.url === 'https://example.com/podcast/ep2')
    expect(episodeTwo).toBeDefined()
    expect(episodeTwo?.text).toContain('iTunes summary show notes for episode two')
  })

  it('falls back to show notes when the transcript url fetch fails (non-OK)', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchRouting({
        feed: { ok: true, body: RSS_FIXTURE },
        transcript: { ok: false },
      }),
    )
    strategy = new PodcastFetchStrategy()

    const results = await strategy.fetch('https://example.com/podcast/feed.xml')

    const episodeOne = results.find((r) => r.url === 'https://example.com/podcast/ep1')
    expect(episodeOne).toBeDefined()
    expect(episodeOne?.text).toContain('Show notes for episode 1 without a transcript.')
  })

  it('falls back to show notes when the transcript url fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchRouting({
        feed: { ok: true, body: RSS_FIXTURE },
        transcript: { reject: true },
      }),
    )
    strategy = new PodcastFetchStrategy()

    const results = await strategy.fetch('https://example.com/podcast/feed.xml')

    const episodeOne = results.find((r) => r.url === 'https://example.com/podcast/ep1')
    expect(episodeOne).toBeDefined()
    expect(episodeOne?.text).toContain('Show notes for episode 1 without a transcript.')
  })

  it('returns an empty array on a non-OK feed response instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    strategy = new PodcastFetchStrategy()

    const results = await strategy.fetch('https://example.com/podcast/missing.xml')

    expect(results).toEqual([])
  })

  it('returns an empty array when the feed is unreachable instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    strategy = new PodcastFetchStrategy()

    await expect(strategy.fetch('https://unreachable.example.com/feed.xml')).resolves.toEqual([])
  })
})
