import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import { parseAnkiDeck } from './anki-deck-parser'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

@Injectable()
export class AnkiFetchStrategy implements FetchStrategy {
  private readonly logger = new Logger(AnkiFetchStrategy.name)

  constructor(@Inject(SCRAPPER_CLIENT) private readonly scrapper: ScrapperClient) {}

  async fetch(url: string): Promise<FetchedContent[]> {
    try {
      const result = await this.scrapper.fetch(url)
      return parseAnkiDeck(result.content, result.url)
    } catch (error) {
      this.logger.warn(
        `anki source yielded no content: url=${url} error=${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }
}
