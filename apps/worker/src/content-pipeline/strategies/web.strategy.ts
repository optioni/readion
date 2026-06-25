import { Inject, Injectable } from '@nestjs/common'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import { isAllowedByRobots } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

@Injectable()
export class WebFetchStrategy implements FetchStrategy {
  constructor(@Inject(SCRAPPER_CLIENT) private readonly scrapper: ScrapperClient) {}

  async fetch(url: string): Promise<FetchedContent[]> {
    const allowed = await isAllowedByRobots(url)
    if (!allowed) return []

    const result = await this.scrapper.fetch(url)
    return [{ text: result.content, url: result.url }]
  }
}
