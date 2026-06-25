import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { embed, embedMany } from 'ai'
import { ProviderAdapter } from './provider-adapter'

export const KNOWN_EMBEDDING_DIMENSIONS: Readonly<Record<string, number>> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

@Injectable()
export class EmbeddingService {
  readonly dimension: number
  private readonly modelId: string

  constructor(
    private readonly providerAdapter: ProviderAdapter,
    private readonly config: ConfigService,
  ) {
    this.modelId = this.config.get<string>('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small'
    const dim = KNOWN_EMBEDDING_DIMENSIONS[this.modelId]
    if (dim === undefined) {
      throw new Error(`Unknown embedding model: ${this.modelId}`)
    }
    this.dimension = dim
  }

  async embed(text: string): Promise<number[]> {
    const model = this.providerAdapter.getEmbeddingModel(this.modelId)
    const result = await embed({ model, value: text })
    return result.embedding
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const model = this.providerAdapter.getEmbeddingModel(this.modelId)
    const result = await embedMany({ model, values: texts })
    return result.embeddings
  }

  assertDimensionMatches(actual: number): void {
    if (actual !== this.dimension) {
      throw new Error(`Embedding dimension mismatch: declared ${this.dimension}, got ${actual}`)
    }
  }
}
