import { Injectable } from '@nestjs/common'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

@Injectable()
export class QuizletFetchStrategy implements FetchStrategy {
  async fetch(_url: string): Promise<FetchedContent[]> {
    return []
  }
}
