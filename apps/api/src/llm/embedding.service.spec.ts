import type { EmbeddingModelV3, EmbeddingModelV3Result } from '@ai-sdk/provider'
import { ConfigService } from '@nestjs/config'
import { MockEmbeddingModelV3 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { EmbeddingService, KNOWN_EMBEDDING_DIMENSIONS } from './embedding.service'
import type { ProviderAdapter } from './provider-adapter'

const DIM = 1536

function makeEmbeddingModel(dimension: number): MockEmbeddingModelV3 {
  return new MockEmbeddingModelV3({
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    maxEmbeddingsPerCall: 2048,
    supportsParallelCalls: true,
    doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
      embeddings: values.map(() => Array.from({ length: dimension }, (_, i) => i / dimension)),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  })
}

function makeAdapter(model: EmbeddingModelV3): ProviderAdapter {
  return {
    getChatModel: () => {
      throw new Error('not used')
    },
    getEmbeddingModel: () => model,
  } as unknown as ProviderAdapter
}

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    AI_EMBEDDING_MODEL: 'text-embedding-3-small',
    AI_EMBEDDING_PROVIDER: 'openai',
    AI_PROVIDER: 'anthropic',
    ...overrides,
  }
  return { get: (k: string) => defaults[k] } as ConfigService
}

describe('EmbeddingService', () => {
  it('declares dimension 1536 for the default text-embedding-3-small model', () => {
    const svc = new EmbeddingService(makeAdapter(makeEmbeddingModel(DIM)), makeConfig())
    expect(svc.dimension).toBe(1536)
  })

  it('embeds a single text and returns a 1536-dimension vector', async () => {
    const svc = new EmbeddingService(makeAdapter(makeEmbeddingModel(DIM)), makeConfig())
    const result = await svc.embed('hello world')
    expect(result).toHaveLength(1536)
  })

  it('embeds many texts and returns N vectors in order in a single batched call', async () => {
    const mockModel = makeEmbeddingModel(DIM)
    const svc = new EmbeddingService(makeAdapter(mockModel), makeConfig())
    const inputs = Array.from({ length: 50 }, (_, i) => `text ${i}`)
    const result = await svc.embedMany(inputs)

    expect(result).toHaveLength(50)
    for (const vec of result) {
      expect(vec).toHaveLength(DIM)
    }
    expect(mockModel.doEmbedCalls).toHaveLength(1)
    expect(mockModel.doEmbedCalls[0].values).toEqual(inputs)
  })

  it('embedding provider is independent of chat provider (AI_PROVIDER=anthropic uses openai embeddings)', async () => {
    const mockModel = makeEmbeddingModel(DIM)
    const adapter = makeAdapter(mockModel)
    const config = makeConfig({
      AI_EMBEDDING_MODEL: 'text-embedding-3-small',
      AI_PROVIDER: 'anthropic',
    })
    const svc = new EmbeddingService(adapter, config)
    const result = await svc.embed('test')
    expect(result).toHaveLength(DIM)
  })

  it('assertDimensionMatches passes when dimensions match', () => {
    const svc = new EmbeddingService(makeAdapter(makeEmbeddingModel(DIM)), makeConfig())
    expect(() => svc.assertDimensionMatches(1536)).not.toThrow()
  })

  it('assertDimensionMatches throws when dimensions do not match', () => {
    const svc = new EmbeddingService(makeAdapter(makeEmbeddingModel(DIM)), makeConfig())
    expect(() => svc.assertDimensionMatches(768)).toThrow(/dimension mismatch/i)
  })

  it('throws at construction for an unknown embedding model', () => {
    expect(
      () =>
        new EmbeddingService(
          makeAdapter(makeEmbeddingModel(DIM)),
          makeConfig({ AI_EMBEDDING_MODEL: 'unknown-model' }),
        ),
    ).toThrow(/unknown embedding model/i)
  })

  it('KNOWN_EMBEDDING_DIMENSIONS covers the default model', () => {
    expect(KNOWN_EMBEDDING_DIMENSIONS['text-embedding-3-small']).toBe(1536)
  })
})
