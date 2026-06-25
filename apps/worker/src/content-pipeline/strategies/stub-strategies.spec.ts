import { describe, expect, it } from 'vitest'
import { AnkiFetchStrategy } from './anki.strategy'
import { PodcastFetchStrategy } from './podcast.strategy'
import { QuizletFetchStrategy } from './quizlet.strategy'

describe('Stub fetch strategies (interface-conformant stubs)', () => {
  it('AnkiFetchStrategy returns an empty array for any URL', async () => {
    const strategy = new AnkiFetchStrategy()
    const result = await strategy.fetch('https://ankiweb.net/shared/info/123')
    expect(result).toEqual([])
  })

  it('PodcastFetchStrategy returns an empty array for any URL', async () => {
    const strategy = new PodcastFetchStrategy()
    const result = await strategy.fetch('https://example.com/podcast.rss')
    expect(result).toEqual([])
  })

  it('QuizletFetchStrategy returns an empty array for any URL', async () => {
    const strategy = new QuizletFetchStrategy()
    const result = await strategy.fetch('https://quizlet.com/cards/aws-certs')
    expect(result).toEqual([])
  })
})
