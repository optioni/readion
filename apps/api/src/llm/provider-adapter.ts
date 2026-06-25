import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { EmbeddingModelV3, LanguageModelV3 } from '@ai-sdk/provider'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EnvConfig } from '../config/env.schema'

@Injectable()
export class ProviderAdapter {
  private readonly chatProvider:
    | ReturnType<typeof createAnthropic>
    | ReturnType<typeof createOpenAI>
  private readonly embeddingProvider: ReturnType<typeof createOpenAI>

  constructor(private readonly config: ConfigService<EnvConfig>) {
    const provider = this.config.get<string>('AI_PROVIDER')
    const apiKey = this.config.get<string>('AI_API_KEY')

    if (provider === 'anthropic') {
      this.chatProvider = createAnthropic({ apiKey })
    } else {
      this.chatProvider = createOpenAI({ apiKey })
    }

    const embeddingApiKey = this.config.get<string>('AI_EMBEDDING_API_KEY') ?? apiKey
    this.embeddingProvider = createOpenAI({ apiKey: embeddingApiKey })
  }

  getChatModel(modelId: string): LanguageModelV3 {
    return (this.chatProvider as (id: string) => LanguageModelV3)(modelId)
  }

  getEmbeddingModel(modelId: string): EmbeddingModelV3 {
    return this.embeddingProvider.embedding(
      modelId as Parameters<ReturnType<typeof createOpenAI>['embedding']>[0],
    )
  }
}
