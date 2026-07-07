import { Injectable } from '@nestjs/common'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

@Injectable()
export class PodcastFetchStrategy implements FetchStrategy {
  readonly isStub = true

  async fetch(_url: string): Promise<FetchedContent[]> {
    return []
  }
}
