import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmService } from './llm.service'

vi.mock('@ai-sdk/openai', () => {
  const factory = Object.assign(vi.fn().mockReturnValue('openai-model'), {
    embedding: vi.fn().mockReturnValue('openai-embedding-model'),
  })
  return { createOpenAI: vi.fn().mockReturnValue(factory) }
})

vi.mock('@ai-sdk/anthropic', () => {
  const factory = Object.assign(vi.fn().mockReturnValue('anthropic-model'), {
    textEmbeddingModel: vi.fn().mockReturnValue('anthropic-embedding-model'),
  })
  return { createAnthropic: vi.fn().mockReturnValue(factory) }
})

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ output: { tags: [] } }),
  embedMany: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]] }),
  Output: {
    object: vi.fn().mockReturnValue('output-spec'),
  },
}))

describe('LlmService', () => {
  let service: LlmService

  const makeConfig = (provider: string) => ({
    get: (key: string) => {
      const values: Record<string, string | number> = {
        AI_PROVIDER: provider,
        AI_API_KEY: 'test-key',
        AI_MODEL_DOMAIN_TAGGING: 'test-model',
        AI_EMBEDDING_MODEL: 'test-embedding-model',
      }
      return values[key]
    },
  })

  describe('with openai provider', () => {
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [LlmService, { provide: ConfigService, useValue: makeConfig('openai') }],
      }).compile()
      service = moduleRef.get(LlmService)
    })

    it('tagDomains returns empty array when output is null', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValueOnce({ output: null } as any)

      const result = await service.tagDomains('text', ['Security'], 0.5)
      expect(result).toEqual([])
    })

    it('tagDomains filters tags below threshold', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValueOnce({
        output: {
          tags: [
            { domain: 'Security', confidence: 0.9 },
            { domain: 'Networking', confidence: 0.3 },
          ],
        },
      } as any)

      const result = await service.tagDomains('text', ['Security', 'Networking'], 0.5)
      expect(result).toHaveLength(1)
      expect(result[0]!.domain).toBe('Security')
    })

    it('embedTexts delegates to embedMany', async () => {
      const { embedMany } = await import('ai')
      vi.mocked(embedMany).mockResolvedValueOnce({ embeddings: [[0.1], [0.2]] } as any)

      const result = await service.embedTexts(['text1', 'text2'])
      expect(result).toHaveLength(2)
    })
  })

  describe('with anthropic provider', () => {
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [LlmService, { provide: ConfigService, useValue: makeConfig('anthropic') }],
      }).compile()
      service = moduleRef.get(LlmService)
    })

    it('uses anthropic for language model and openai fallback for embeddings', async () => {
      const { embedMany } = await import('ai')
      vi.mocked(embedMany).mockResolvedValueOnce({ embeddings: [[0.1]] } as any)

      const result = await service.embedTexts(['text'])
      expect(result).toHaveLength(1)
    })
  })
})
