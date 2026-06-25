import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YouTubeFetchStrategy } from './youtube.strategy'

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}))

describe('YouTubeFetchStrategy', () => {
  let strategy: YouTubeFetchStrategy
  let fetchTranscript: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { YoutubeTranscript } = await import('youtube-transcript')
    fetchTranscript = YoutubeTranscript.fetchTranscript as ReturnType<typeof vi.fn>
    strategy = new YouTubeFetchStrategy()
  })

  it('fetches transcript segments and captures startOffsetSeconds', async () => {
    fetchTranscript.mockResolvedValue([
      { text: 'Hello and welcome', offset: 0, duration: 3000 },
      { text: 'Today we will discuss', offset: 3000, duration: 4000 },
      { text: 'AWS security practices', offset: 7000, duration: 5000 },
    ])

    const results = await strategy.fetch('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(results).toHaveLength(3)
    expect(results[0]!.metadata?.startOffsetSeconds).toBe(0)
    expect(results[1]!.metadata?.startOffsetSeconds).toBe(3)
    expect(results[2]!.metadata?.startOffsetSeconds).toBe(7)
  })

  it('stores per-segment startOffsetSeconds in chunk metadata', async () => {
    fetchTranscript.mockResolvedValue([
      { text: 'Segment at 2 minutes', offset: 120_000, duration: 5000 },
    ])

    const results = await strategy.fetch('https://www.youtube.com/watch?v=abc123')
    expect(results[0]!.metadata?.startOffsetSeconds).toBe(120)
  })

  it('returns empty array for invalid YouTube URL', async () => {
    const results = await strategy.fetch('https://example.com/not-youtube')
    expect(results).toHaveLength(0)
    expect(fetchTranscript).not.toHaveBeenCalled()
  })

  it('handles youtu.be short URLs', async () => {
    fetchTranscript.mockResolvedValue([{ text: 'Content', offset: 0, duration: 3000 }])
    const results = await strategy.fetch('https://youtu.be/dQw4w9WgXcQ')
    expect(results).toHaveLength(1)
  })
})
