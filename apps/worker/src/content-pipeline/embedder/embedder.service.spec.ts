import { Test } from '@nestjs/testing'
import { EMBEDDING_DIMENSION } from '@readion/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmService } from '../../llm/llm.service'
import { EmbedderService } from './embedder.service'

function makeEmbedding(dim = EMBEDDING_DIMENSION): number[] {
  return Array.from({ length: dim }, (_, i) => i / dim)
}

describe('EmbedderService', () => {
  let service: EmbedderService
  let llmService: { embedTexts: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    llmService = { embedTexts: vi.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [EmbedderService, { provide: LlmService, useValue: llmService }],
    }).compile()

    service = moduleRef.get(EmbedderService)
  })

  it('embeds texts in a single batch call when count ≤ batchSize', async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text ${i}`)
    const embeddings = texts.map(() => makeEmbedding())
    llmService.embedTexts.mockResolvedValue(embeddings)

    const result = await service.embedChunks(texts)
    expect(llmService.embedTexts).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(10)
  })

  it('each result is a 1536-dim vector', async () => {
    const texts = ['hello world']
    llmService.embedTexts.mockResolvedValue([makeEmbedding()])

    const result = await service.embedChunks(texts)
    expect(result[0]).toHaveLength(EMBEDDING_DIMENSION)
  })

  it('delegates batching to LlmService with the default batchSize', async () => {
    const texts = Array.from({ length: 40 }, (_, i) => `text ${i}`)
    llmService.embedTexts.mockResolvedValue(texts.map(() => makeEmbedding()))

    await service.embedChunks(texts)
    expect(llmService.embedTexts).toHaveBeenCalledWith(texts, 100)
  })

  it('returns empty array for empty input', async () => {
    llmService.embedTexts.mockResolvedValue([])
    const result = await service.embedChunks([])
    expect(result).toHaveLength(0)
  })
})
