import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ExtractiveItem, Provenance } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import type { EnvConfig } from '../config/env.schema'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { validateExtractiveContract } from './extractive-contract'
import {
  GROUNDING_ABSTENTIONS_METRIC,
  GROUNDING_REGENERATIONS_METRIC,
  GROUNDING_SUBSTITUTIONS_METRIC,
} from './grounding.metrics'
import type {
  GenerationFn,
  GenerationOptions,
  GroundedChunk,
  GroundedGenerationResult,
} from './types'
import { VerifierService } from './verifier.service'

@Injectable()
export class GroundedGenerationService {
  constructor(
    private readonly verifier: VerifierService,
    private readonly cache: LlmResponseCacheService,
    private readonly config: ConfigService<EnvConfig>,
    @InjectMetric(GROUNDING_REGENERATIONS_METRIC)
    private readonly regenerationsCounter: Counter,
    @InjectMetric(GROUNDING_SUBSTITUTIONS_METRIC)
    private readonly substitutionsCounter: Counter,
    @InjectMetric(GROUNDING_ABSTENTIONS_METRIC)
    private readonly abstentionsCounter: Counter,
  ) {}

  private get maxRegenAttempts(): number {
    return this.config.get<number>('GROUNDING_MAX_REGEN_ATTEMPTS') ?? 3
  }

  private get similarityThreshold(): number {
    return this.config.get<number>('GROUNDING_SIMILARITY_THRESHOLD') ?? 0.75
  }

  async generate(
    generationFn: GenerationFn,
    chunks: GroundedChunk[],
    options: GenerationOptions,
  ): Promise<GroundedGenerationResult> {
    const allBelowThreshold = chunks.every((c) => c.similarity < this.similarityThreshold)
    if (allBelowThreshold) {
      this.abstentionsCounter.inc()
      return {
        success: false,
        signal: {
          type: 'fetchMoreMaterial',
          certificationId: options.certificationId,
          domain: options.domain,
        },
      }
    }

    const chunkRefs = chunks.map((c) => ({ id: c.id, text: c.text }))
    let regenerations = 0
    const maxAttempts = this.maxRegenAttempts + 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        this.regenerationsCounter.inc()
        regenerations++
      }

      const item = await generationFn(chunks)
      const contractResult = validateExtractiveContract(item, chunkRefs)
      if (!contractResult.valid) {
        continue
      }

      const verdict = await this.verifier.verify(item, chunks)
      if (!verdict.pass) {
        continue
      }

      const provenance: Provenance = {
        sourceChunkIds: item.sourceChunkIds,
        supportingSpans: item.supportingSpans,
        verdict,
        score: verdict.score,
      }

      await this.cache.set(
        options.cacheKey,
        chunks.map((c) => c.id),
        {
          text: JSON.stringify({ item, provenance }),
          usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
          verified: true,
        },
      )

      return { success: true, item, provenance, regenerations }
    }

    this.substitutionsCounter.inc()
    return { success: false, signal: { type: 'substitution' } }
  }

  extractItemFromCache(cached: NonNullable<Awaited<ReturnType<LlmResponseCacheService['get']>>>): {
    item: ExtractiveItem
    provenance: Provenance
  } {
    return JSON.parse(cached.text) as { item: ExtractiveItem; provenance: Provenance }
  }
}

export type { GenerationFn, GenerationOptions, GroundedChunk, GroundedGenerationResult }
