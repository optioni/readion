import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedditFetchStrategy } from './reddit.strategy'

describe('RedditFetchStrategy', () => {
  let strategy: RedditFetchStrategy

  beforeEach(() => {
    strategy = new RedditFetchStrategy()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches subreddit posts via the public JSON API', async () => {
    const mockJson = [
      {
        data: {
          children: [
            {
              data: {
                title: 'AWS Security Tips',
                selftext: 'Here are some tips...',
                url: 'https://reddit.com/r/aws/abc',
              },
            },
            {
              data: {
                title: 'Cloud Architecture Guide',
                selftext: 'Guide content',
                url: 'https://reddit.com/r/aws/def',
              },
            },
          ],
        },
      },
      { data: { children: [] } },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) }),
    )

    const results = await strategy.fetch('https://www.reddit.com/r/aws/top')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.text).toContain('AWS Security Tips')
  })

  it('returns empty array on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const results = await strategy.fetch('https://www.reddit.com/r/aws')
    expect(results).toHaveLength(0)
  })
})
