import { Module } from '@nestjs/common'
import { ContentChunkRepository } from '../content-pipeline/repository/content-chunk.repository'
import { SemanticSearchService } from './semantic-search.service'

@Module({
  providers: [SemanticSearchService, ContentChunkRepository],
  exports: [SemanticSearchService],
})
export class SemanticSearchModule {}
