import type { LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { Test } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import { MockLanguageModelV3 } from 'ai/test'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiConfigModule } from '../config/config.module'
import { RedisModule } from '../redis/redis.module'
import { buildCacheKey } from './cache-key.builder'
import { LlmModule } from './llm.module'
import { LlmService } from './llm.service'
import { LlmResponseCacheService } from './llm-response-cache.service'
import { ProviderAdapter } from './provider-adapter'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

describe('LlmModule acceptance', () => {
  let container: StartedTestContainer
  let llmService: LlmService
  let cacheService: LlmResponseCacheService
  let sdkCallCount: number

  beforeAll(async () => {
    container = await startRedisContainer()
    process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`
    process.env.AI_RESPONSE_CACHE_TTL_SECONDS = '60'

    sdkCallCount = 0
    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => {
        sdkCallCount++
        return {
          content: [{ type: 'text', text: 'What is EC2?' }],
          finishReason: FINISH_REASON_STOP,
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 50, text: 50, reasoning: 0 },
          },
          warnings: [],
        }
      },
    })

    const moduleRef = await Test.createTestingModule({
      imports: [ApiConfigModule, RedisModule, LlmModule],
    })
      .overrideProvider(ProviderAdapter)
      .useValue({
        getChatModel: vi.fn().mockReturnValue(mockModel),
        getEmbeddingModel: vi.fn(),
      })
      .compile()

    llmService = moduleRef.get(LlmService)
    cacheService = moduleRef.get(LlmResponseCacheService)
  }, 60_000)

  afterAll(async () => {
    await container?.stop()
  })

  it('generates text via the SDK and caches the verified result; second read is a cache hit with no SDK call; eviction causes a miss and the next generate calls the SDK again', async () => {
    // 1. Generate — SDK is called once
    const result = await llmService.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'Generate a quiz about EC2' }],
    })
    expect(result.text).toBe('What is EC2?')
    expect(result.usage.inputTokens).toBe(10)
    expect(result.usage.outputTokens).toBe(50)
    expect(sdkCallCount).toBe(1)

    // 2. Cache the verified result
    const key = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['chunk-1', 'chunk-2'],
      difficulty: 'medium',
      format: 'mcq',
    })
    await cacheService.set(key, ['chunk-1', 'chunk-2'], { ...result, verified: true })

    // 3. Cache hit — no SDK call
    const cached = await cacheService.get(key)
    expect(cached).not.toBeNull()
    expect(cached?.text).toBe('What is EC2?')
    expect(sdkCallCount).toBe(1)

    // 4. Evict
    await cacheService.evict(key)
    const afterEvict = await cacheService.get(key)
    expect(afterEvict).toBeNull()

    // 5. Generate again after eviction — SDK is called again
    const result2 = await llmService.generateText({
      taskType: 'quiz-generation',
      messages: [{ role: 'user', content: 'Generate a quiz about EC2' }],
    })
    expect(result2.text).toBe('What is EC2?')
    expect(sdkCallCount).toBe(2)
  })

  it('rejects an unverified payload at the cache boundary', async () => {
    const key = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['chunk-unverified'],
      difficulty: 'hard',
      format: 'free-response',
    })

    const badInput = {
      text: 'bad',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      verified: false,
    }
    // @ts-expect-error deliberate type violation to test runtime guard
    await expect(cacheService.set(key, [], badInput)).rejects.toThrow()

    const result = await cacheService.get(key)
    expect(result).toBeNull()
  })
})
