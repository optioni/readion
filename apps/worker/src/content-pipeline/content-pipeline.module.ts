import { Module } from '@nestjs/common'
import { LlmModule } from '../llm/llm.module'
import { StaleSourceCron } from './cron/stale-source.cron'
import { DomainTaggerService } from './domain-tagger/domain-tagger.service'
import { EmbedderService } from './embedder/embedder.service'
import { IngestionMetricService } from './metrics/ingestion-metric.service'
import { IngestionService } from './processor/ingestion.service'
import { INGESTION_PROCESSORS } from './processor/typed-ingestion-processors'
import { ContentQueuesModule } from './queues/content-queues.module'
import { ContentQueuesService } from './queues/content-queues.service'
import { ContentChunkRepository } from './repository/content-chunk.repository'
import { ContentSourceRepository } from './repository/content-source.repository'
import { AnkiFetchStrategy } from './strategies/anki.strategy'
import { GitHubFetchStrategy } from './strategies/github.strategy'
import { PdfFetchStrategy } from './strategies/pdf.strategy'
import { PodcastFetchStrategy } from './strategies/podcast.strategy'
import { QuizletFetchStrategy } from './strategies/quizlet.strategy'
import { RedditFetchStrategy } from './strategies/reddit.strategy'
import { StrategyRegistry } from './strategies/strategy.registry'
import { WebFetchStrategy } from './strategies/web.strategy'
import { YouTubeFetchStrategy } from './strategies/youtube.strategy'

@Module({
  imports: [LlmModule, ContentQueuesModule],
  providers: [
    WebFetchStrategy,
    PdfFetchStrategy,
    YouTubeFetchStrategy,
    RedditFetchStrategy,
    GitHubFetchStrategy,
    PodcastFetchStrategy,
    AnkiFetchStrategy,
    QuizletFetchStrategy,
    StrategyRegistry,
    DomainTaggerService,
    EmbedderService,
    ContentChunkRepository,
    ContentSourceRepository,
    IngestionMetricService,
    ContentQueuesService,
    StaleSourceCron,
    ...INGESTION_PROCESSORS,
    {
      provide: 'StrategyRegistry',
      useExisting: StrategyRegistry,
    },
    {
      provide: 'DomainTaggerService',
      useExisting: DomainTaggerService,
    },
    {
      provide: 'EmbedderService',
      useExisting: EmbedderService,
    },
    {
      provide: 'IngestionMetricService',
      useExisting: IngestionMetricService,
    },
    IngestionService,
  ],
  exports: [
    ContentChunkRepository,
    ContentSourceRepository,
    ContentQueuesService,
    IngestionService,
  ],
})
export class ContentPipelineModule {}
