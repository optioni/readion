import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ContentSourceType } from '@readion/shared'
import type { WorkerEnvConfig } from '../../config/env.schema'
import { chunkText } from '../chunker/chunker'
// Using import type for injected-by-token dependencies (DI resolved via @Inject decorator)
import type { DomainTaggerService } from '../domain-tagger/domain-tagger.service'
import type { EmbedderService } from '../embedder/embedder.service'
import type { IngestionMetricService } from '../metrics/ingestion-metric.service'
import { CertPromotionService } from '../promotion/cert-promotion.service'
import { ChunkReconciliationService } from '../reconciliation/chunk-reconciliation.service'
import { ContentChunkRepository } from '../repository/content-chunk.repository'
import { ContentSourceRepository } from '../repository/content-source.repository'
import type { StrategyRegistry } from '../strategies/strategy.registry'

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name)

  constructor(
    @Inject('StrategyRegistry') private readonly strategyRegistry: StrategyRegistry,
    @Inject('DomainTaggerService') private readonly tagger: DomainTaggerService,
    @Inject('EmbedderService') private readonly embedder: EmbedderService,
    private readonly chunkRepo: ContentChunkRepository,
    private readonly sourceRepo: ContentSourceRepository,
    private readonly config: ConfigService<WorkerEnvConfig>,
    @Inject('IngestionMetricService') private readonly metrics: IngestionMetricService,
    private readonly reconciliation: ChunkReconciliationService,
    private readonly certPromotion: CertPromotionService,
  ) {}

  async ingest(sourceId: string, domains: string[]): Promise<void> {
    const source = await this.sourceRepo.findById(sourceId)
    if (!source) {
      this.logger.warn(`ContentSource ${sourceId} not found`)
      return
    }

    const chunkSize = this.config.get('CONTENT_CHUNK_SIZE') ?? 500
    const chunkOverlap = this.config.get('CONTENT_CHUNK_OVERLAP') ?? 50
    const strategy = this.strategyRegistry.get(source.type as ContentSourceType)

    this.logger.log(`Ingesting source ${sourceId} (${source.type}: ${source.url})`)

    const fetchedItems = await strategy.fetch(source.url)
    if (fetchedItems.length === 0) {
      this.logger.warn(`No content fetched for source ${sourceId}`)
      throw new Error(`No content fetched for source ${sourceId} (${source.type}: ${source.url})`)
    }

    const allFetchedHashes: string[] = []

    for (const item of fetchedItems) {
      const chunks = chunkText(item.text, { chunkSize, overlap: chunkOverlap })

      const tagResults = await Promise.all(chunks.map((c) => this.tagger.tag(c.text, domains)))
      const embeddings = await this.embedder.embedChunks(chunks.map((c) => c.text))

      const inputs = chunks.map((chunk, i) => ({
        contentSourceId: sourceId,
        certificationId: source.certificationId,
        text: chunk.text,
        contentHash: chunk.contentHash,
        embedding: embeddings[i] ?? [],
        domainTags: tagResults[i]?.tags ?? [],
        primaryDomain: tagResults[i]?.primaryDomain ?? 'unknown',
        metadata: { ...item.metadata },
      }))

      await this.chunkRepo.upsertMany(inputs)
      this.metrics.increment(source.type as ContentSourceType, inputs.length)
      allFetchedHashes.push(...inputs.map((inp) => inp.contentHash))
    }

    await this.reconciliation.reconcile(sourceId, allFetchedHashes)

    await this.sourceRepo.updateLastFetchedAt(sourceId, new Date())
    this.logger.log(`Source ${sourceId} ingested successfully`)

    await this.certPromotion.evaluateAndPromote(source.certificationId)
  }
}
