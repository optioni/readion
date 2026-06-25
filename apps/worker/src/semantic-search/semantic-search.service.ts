import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { WorkerEnvConfig } from '../config/env.schema'
import type { ChunkSearchResult } from '../content-pipeline/repository/content-chunk.repository'
import { ContentChunkRepository } from '../content-pipeline/repository/content-chunk.repository'

export type { ChunkSearchResult }

export interface SearchOptions {
  threshold?: number
  limit?: number
  domains?: string[]
}

@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly chunkRepo: ContentChunkRepository,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  async search(
    queryEmbedding: number[],
    certificationId: string,
    options: SearchOptions = {},
  ): Promise<ChunkSearchResult[]> {
    const threshold = options.threshold ?? this.config.get('CONTENT_SIMILARITY_THRESHOLD') ?? 0.75
    const limit = options.limit ?? 20
    const domains = options.domains

    return this.chunkRepo.findByCertification(certificationId, queryEmbedding, {
      threshold,
      limit,
      domains,
    })
  }
}
