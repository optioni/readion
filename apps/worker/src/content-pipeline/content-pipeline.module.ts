import { Module } from '@nestjs/common'
import { queryCoverageStats } from '@readion/db'
import { CERT_EXTRACTION_QUEUE } from '@readion/shared'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import { LlmModule } from '../llm/llm.module'
import { registerSourceQueue } from '../queue/queue.helpers'
import { CertExtractionProcessor } from './cert-extraction/cert-extraction.processor'
import { CertExtractionService } from './cert-extraction/cert-extraction.service'
import {
  CERTS_DUE_FOR_REVERIFICATION_GAUGE,
  CertReverificationCron,
} from './cron/cert-reverification.cron'
import { StaleSourceCron } from './cron/stale-source.cron'
import { SupersededChunkCleanupCron } from './cron/superseded-chunk-cleanup.cron'
import { DomainTaggerService } from './domain-tagger/domain-tagger.service'
import { EmbedderService } from './embedder/embedder.service'
import { IngestionMetricService } from './metrics/ingestion-metric.service'
import { IngestionService } from './processor/ingestion.service'
import { INGESTION_PROCESSORS } from './processor/typed-ingestion-processors'
import { CertPromotionService, COVERAGE_STATS_QUERY } from './promotion/cert-promotion.service'
import { ContentQueuesModule } from './queues/content-queues.module'
import { ContentQueuesService } from './queues/content-queues.service'
import { ChunkReconciliationService } from './reconciliation/chunk-reconciliation.service'
import { ContentChunkRepository } from './repository/content-chunk.repository'
import { ContentSourceRepository } from './repository/content-source.repository'
import { AnkiFetchStrategy } from './strategies/anki.strategy'
import { GitHubFetchStrategy } from './strategies/github.strategy'
import { PdfFetchStrategy } from './strategies/pdf.strategy'
import { PodcastFetchStrategy } from './strategies/podcast.strategy'
import { RedditFetchStrategy } from './strategies/reddit.strategy'
import { StrategyRegistry } from './strategies/strategy.registry'
import { WebFetchStrategy } from './strategies/web.strategy'
import { YouTubeFetchStrategy } from './strategies/youtube.strategy'
import { ChunkSupersessionService } from './supersession/chunk-supersession.service'

@Module({
  imports: [LlmModule, ContentQueuesModule, registerSourceQueue(CERT_EXTRACTION_QUEUE)],
  providers: [
    CertExtractionService,
    CertExtractionProcessor,
    WebFetchStrategy,
    PdfFetchStrategy,
    YouTubeFetchStrategy,
    RedditFetchStrategy,
    GitHubFetchStrategy,
    PodcastFetchStrategy,
    AnkiFetchStrategy,
    StrategyRegistry,
    DomainTaggerService,
    EmbedderService,
    ContentChunkRepository,
    ContentSourceRepository,
    IngestionMetricService,
    ContentQueuesService,
    StaleSourceCron,
    CertReverificationCron,
    makeGaugeProvider({
      name: CERTS_DUE_FOR_REVERIFICATION_GAUGE,
      help: 'Current number of certifications due for re-verification',
    }),
    ChunkSupersessionService,
    ChunkReconciliationService,
    SupersededChunkCleanupCron,
    ...INGESTION_PROCESSORS,
    CertPromotionService,
    {
      provide: COVERAGE_STATS_QUERY,
      useValue: queryCoverageStats,
    },
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
    ChunkSupersessionService,
    ChunkReconciliationService,
    SupersededChunkCleanupCron,
    IngestionService,
  ],
})
export class ContentPipelineModule {}
