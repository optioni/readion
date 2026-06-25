import { Injectable } from '@nestjs/common'
import type { ContentSourceType } from '@readion/shared'
import { AnkiFetchStrategy } from './anki.strategy'
import type { FetchStrategy } from './fetch-strategy.interface'
import { GitHubFetchStrategy } from './github.strategy'
import { PdfFetchStrategy } from './pdf.strategy'
import { PodcastFetchStrategy } from './podcast.strategy'
import { QuizletFetchStrategy } from './quizlet.strategy'
import { RedditFetchStrategy } from './reddit.strategy'
import { WebFetchStrategy } from './web.strategy'
import { YouTubeFetchStrategy } from './youtube.strategy'

@Injectable()
export class StrategyRegistry {
  private readonly strategies: Record<ContentSourceType, FetchStrategy>

  constructor(
    web: WebFetchStrategy,
    pdf: PdfFetchStrategy,
    youtube: YouTubeFetchStrategy,
    reddit: RedditFetchStrategy,
    github: GitHubFetchStrategy,
    podcast: PodcastFetchStrategy,
    anki: AnkiFetchStrategy,
    quizlet: QuizletFetchStrategy,
  ) {
    this.strategies = { web, pdf, youtube, reddit, github, podcast, anki, quizlet }
  }

  get(type: ContentSourceType): FetchStrategy {
    return this.strategies[type]
  }
}
