import { Global, Module } from '@nestjs/common'
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus'
import { EmbeddingService } from './embedding.service'
import {
  LLM_DURATION_METRIC,
  LLM_ERRORS_METRIC,
  LLM_TOKEN_USAGE_METRIC,
  LlmService,
} from './llm.service'
import { LlmResponseCacheService } from './llm-response-cache.service'
import { ModelRegistryService } from './model-registry.service'
import { ProviderAdapter } from './provider-adapter'

@Global()
@Module({
  providers: [
    ProviderAdapter,
    ModelRegistryService,
    EmbeddingService,
    LlmService,
    LlmResponseCacheService,
    makeHistogramProvider({
      name: LLM_DURATION_METRIC,
      help: 'LLM request duration in seconds',
      labelNames: ['model', 'use_case'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }),
    makeCounterProvider({
      name: LLM_TOKEN_USAGE_METRIC,
      help: 'Total LLM token usage by type',
      labelNames: ['model', 'use_case', 'token_type'],
    }),
    makeCounterProvider({
      name: LLM_ERRORS_METRIC,
      help: 'Total LLM errors',
      labelNames: ['model', 'use_case'],
    }),
  ],
  exports: [LlmService, EmbeddingService, LlmResponseCacheService],
})
export class LlmModule {}
