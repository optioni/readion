import type { LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { Test } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import type { ExtractiveItem, VerifierVerdict } from '@readion/shared'
import { MockLanguageModelV3 } from 'ai/test'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiConfigModule } from '../config/config.module'
import { LlmModule } from '../llm/llm.module'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { ProviderAdapter } from '../llm/provider-adapter'
import { RedisModule } from '../redis/redis.module'
import { GroundedGenerationService } from './grounded-generation.service'
import { GroundingModule } from './grounding.module'
import { QuarantineService } from './quarantine.service'
import type { GenerationFn, GroundedChunk } from './types'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

const FIXTURE_CHUNKS: GroundedChunk[] = [
  {
    id: 'chunk-1',
    text: 'Amazon EC2 provides scalable computing capacity in the cloud. The default limit is 100 instances.',
    similarity: 0.9,
    primaryDomain: 'compute',
  },
]

const VALID_ITEM: ExtractiveItem = {
  question: 'What does EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

const PASSING_VERDICT: VerifierVerdict = {
  pass: true,
  score: 0.95,
  distractorFindings: [
    { option: 'Object storage', isCorrect: false, reason: 'Not EC2' },
    { option: 'DNS', isCorrect: false, reason: 'Not EC2' },
    { option: 'Load balancing', isCorrect: false, reason: 'That is ELB' },
  ],
}

const FAILING_VERDICT: VerifierVerdict = {
  pass: false,
  score: 0.2,
  distractorFindings: [],
}

function makeModelResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: FINISH_REASON_STOP,
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 50, reasoning: 0 },
    },
    warnings: [],
  }
}

describe('GroundingModule acceptance', () => {
  let container: StartedTestContainer
  let groundedGenerationService: GroundedGenerationService
  let quarantineService: QuarantineService
  let cacheService: LlmResponseCacheService

  const verifierResponses: string[] = []
  let callCount = 0

  beforeAll(async () => {
    container = await startRedisContainer()
    process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`

    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => {
        const text = verifierResponses[callCount] ?? JSON.stringify(PASSING_VERDICT)
        callCount++
        return makeModelResponse(text)
      },
    })

    const moduleRef = await Test.createTestingModule({
      imports: [ApiConfigModule, RedisModule, LlmModule, GroundingModule],
    })
      .overrideProvider(ProviderAdapter)
      .useValue({
        getChatModel: vi.fn().mockReturnValue(mockModel),
        getEmbeddingModel: vi.fn(),
      })
      .compile()

    groundedGenerationService = moduleRef.get(GroundedGenerationService)
    quarantineService = moduleRef.get(QuarantineService)
    cacheService = moduleRef.get(LlmResponseCacheService)
  }, 60_000)

  afterAll(async () => {
    await container?.stop()
  })

  beforeEach(async () => {
    verifierResponses.length = 0
    callCount = 0
  })

  it('happy path: a generation function producing a contract-valid item that the verifier passes is returned marked verified with provenance and cached', async () => {
    verifierResponses.push(JSON.stringify(PASSING_VERDICT))

    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const result = await groundedGenerationService.generate(generationFn, FIXTURE_CHUNKS, {
      cacheKey: 'acceptance-test-key-1',
      certificationId: 'aws-saa',
      domain: 'compute',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.item.question).toBe(VALID_ITEM.question)
      expect(result.provenance.verdict.pass).toBe(true)
      expect(result.regenerations).toBe(0)
    }

    const cached = await cacheService.get('acceptance-test-key-1')
    expect(cached).not.toBeNull()
    expect(cached?.verified).toBe(true)
  })

  it('recovery: first verifier failure followed by a passing regeneration returns the second item and records one regeneration', async () => {
    verifierResponses.push(JSON.stringify(FAILING_VERDICT))
    verifierResponses.push(JSON.stringify(PASSING_VERDICT))

    let callN = 0
    const generationFn: GenerationFn = vi.fn().mockImplementation(() => {
      callN++
      return Promise.resolve(VALID_ITEM)
    })

    const result = await groundedGenerationService.generate(generationFn, FIXTURE_CHUNKS, {
      cacheKey: 'acceptance-test-key-2',
      certificationId: 'aws-saa',
      domain: 'compute',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.regenerations).toBe(1)
    }
    expect(callN).toBe(2)
  })

  it('quarantine: quarantining a cache key evicts it so the next read is a miss', async () => {
    verifierResponses.push(JSON.stringify(PASSING_VERDICT))

    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const result = await groundedGenerationService.generate(generationFn, FIXTURE_CHUNKS, {
      cacheKey: 'acceptance-test-key-3',
      certificationId: 'aws-saa',
      domain: 'compute',
    })

    expect(result.success).toBe(true)
    const beforeQuarantine = await cacheService.get('acceptance-test-key-3')
    expect(beforeQuarantine).not.toBeNull()

    if (result.success) {
      await quarantineService.quarantine(
        'acceptance-test-key-3',
        result.provenance,
        'user-report',
        'aws-saa',
      )
    }

    const afterQuarantine = await cacheService.get('acceptance-test-key-3')
    expect(afterQuarantine).toBeNull()
  })
})
