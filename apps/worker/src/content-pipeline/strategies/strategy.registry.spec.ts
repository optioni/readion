import { contentSourceTypes } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { ScrapperClient } from '../../scrapper/scrapper.client'
import { AnkiFetchStrategy } from './anki.strategy'
import { GitHubFetchStrategy } from './github.strategy'
import { PdfFetchStrategy } from './pdf.strategy'
import { PodcastFetchStrategy } from './podcast.strategy'
import { RedditFetchStrategy } from './reddit.strategy'
import { StrategyRegistry } from './strategy.registry'
import { WebFetchStrategy } from './web.strategy'
import { YouTubeFetchStrategy } from './youtube.strategy'

describe('StrategyRegistry', () => {
  it('resolves every offered content source type to a non-stub strategy', () => {
    const scrapper = new ScrapperClient('http://127.0.0.1:1')
    const registry = new StrategyRegistry(
      new WebFetchStrategy(scrapper),
      new PdfFetchStrategy(scrapper),
      new YouTubeFetchStrategy(),
      new RedditFetchStrategy(),
      new GitHubFetchStrategy(),
      new PodcastFetchStrategy(),
      new AnkiFetchStrategy(scrapper),
    )

    for (const type of contentSourceTypes) {
      const strategy = registry.get(type)
      expect(
        (strategy as unknown as { isStub?: boolean }).isStub,
        `expected strategy for offered type "${type}" to not be a build-time no-op stub`,
      ).not.toBe(true)
    }
  })
})
