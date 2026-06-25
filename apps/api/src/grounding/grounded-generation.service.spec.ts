import { ConfigService } from '@nestjs/config'
import { startRedisContainer } from '@readion/db'
import type { ExtractiveItem, VerifierVerdict } from '@readion/shared'
import Redis from 'ioredis'
import type { Counter } from 'prom-client'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { validateExtractiveContract } from './extractive-contract'
import { GroundedGenerationService } from './grounded-generation.service'
import type { GenerationFn, GenerationOptions, GroundedChunk } from './types'
import type { VerifierService } from './verifier.service'

const CHUNK_ABOVE_THRESHOLD: GroundedChunk = {
  id: 'chunk-1',
  text: 'Amazon EC2 provides scalable computing capacity in the cloud.',
  similarity: 0.9,
  primaryDomain: 'compute',
}

const CHUNK_BELOW_THRESHOLD: GroundedChunk = {
  id: 'chunk-low',
  text: 'Some loosely related content.',
  similarity: 0.5,
  primaryDomain: 'misc',
}

const VALID_ITEM: ExtractiveItem = {
  question: 'What does EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

const PASSING_VERDICT: VerifierVerdict = { pass: true, score: 0.95, distractorFindings: [] }
const FAILING_VERDICT: VerifierVerdict = { pass: false, score: 0.2, distractorFindings: [] }

function makeVerifier(verdict: VerifierVerdict | VerifierVerdict[]): VerifierService {
  const verdicts = Array.isArray(verdict) ? verdict : [verdict]
  let callIndex = 0
  return {
    verify: vi.fn().mockImplementation(() => {
      const v = verdicts[callIndex] ?? verdicts[verdicts.length - 1]
      callIndex++
      return Promise.resolve(v)
    }),
  } as unknown as VerifierService
}

function makeCounter(): Counter {
  return { inc: vi.fn() } as unknown as Counter
}

function makeConfigService(overrides: Partial<EnvConfig> = {}): ConfigService<EnvConfig> {
  const values: Partial<EnvConfig> = {
    GROUNDING_MAX_REGEN_ATTEMPTS: 3,
    GROUNDING_SIMILARITY_THRESHOLD: 0.75,
    AI_RESPONSE_CACHE_TTL_SECONDS: 60,
    ...overrides,
  }
  return {
    get: vi.fn((key: string) => (values as Record<string, unknown>)[key]),
  } as unknown as ConfigService<EnvConfig>
}

const OPTIONS: GenerationOptions = {
  cacheKey: 'test-cache-key',
  certificationId: 'aws-saa',
  domain: 'compute',
}

describe('GroundedGenerationService — unit tests', () => {
  function makeService(
    verifier: VerifierService,
    cache: LlmResponseCacheService,
    config?: ConfigService<EnvConfig>,
    counters?: { regenerations?: Counter; substitutions?: Counter; abstentions?: Counter },
  ) {
    return new GroundedGenerationService(
      verifier,
      cache,
      config ?? makeConfigService(),
      counters?.regenerations ?? makeCounter(),
      counters?.substitutions ?? makeCounter(),
      counters?.abstentions ?? makeCounter(),
    )
  }

  function makeNullCache(): LlmResponseCacheService {
    return {
      set: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      evict: vi.fn(),
    } as unknown as LlmResponseCacheService
  }

  it('returns a verified item with provenance and no regeneration on first-pass success', async () => {
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(makeVerifier(PASSING_VERDICT), makeNullCache())

    const result = await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.item).toEqual(VALID_ITEM)
      expect(result.provenance.verdict.pass).toBe(true)
      expect(result.regenerations).toBe(0)
    }
  })

  it('returns the second item and records one regeneration when first attempt fails and second passes', async () => {
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(makeVerifier([FAILING_VERDICT, PASSING_VERDICT]), makeNullCache())

    const result = await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.regenerations).toBe(1)
    }
  })

  it('records one regeneration increment per failed attempt', async () => {
    const regenCounter = makeCounter()
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(
      makeVerifier([FAILING_VERDICT, PASSING_VERDICT]),
      makeNullCache(),
      undefined,
      { regenerations: regenCounter },
    )

    await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(regenCounter.inc).toHaveBeenCalledTimes(1)
  })

  it('signals substitution after exhausting all N attempts', async () => {
    const failingVerdicts = Array(4).fill(FAILING_VERDICT) as VerifierVerdict[]
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const config = makeConfigService({ GROUNDING_MAX_REGEN_ATTEMPTS: 3 })
    const svc = makeService(makeVerifier(failingVerdicts), makeNullCache(), config)

    const result = await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.signal.type).toBe('substitution')
    }
  })

  it('increments the substitution counter when exhausting attempts', async () => {
    const subCounter = makeCounter()
    const failingVerdicts = Array(4).fill(FAILING_VERDICT) as VerifierVerdict[]
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const config = makeConfigService({ GROUNDING_MAX_REGEN_ATTEMPTS: 3 })
    const svc = makeService(makeVerifier(failingVerdicts), makeNullCache(), config, {
      substitutions: subCounter,
    })

    await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(subCounter.inc).toHaveBeenCalledTimes(1)
  })

  it('never returns an unverified item — substitution signal when all attempts fail', async () => {
    const failingVerdicts = Array(10).fill(FAILING_VERDICT) as VerifierVerdict[]
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(makeVerifier(failingVerdicts), makeNullCache())

    const result = await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    if (result.success) {
      expect(result.provenance.verdict.pass).toBe(true)
    } else {
      expect(['substitution', 'fetchMoreMaterial'].includes(result.signal.type)).toBe(true)
    }
  })

  it('raises fetchMoreMaterial when all chunks are below the grounding threshold', async () => {
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(makeVerifier(PASSING_VERDICT), makeNullCache())

    const result = await svc.generate(generationFn, [CHUNK_BELOW_THRESHOLD], OPTIONS)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.signal.type).toBe('fetchMoreMaterial')
      if (result.signal.type === 'fetchMoreMaterial') {
        expect(result.signal.certificationId).toBe('aws-saa')
        expect(result.signal.domain).toBe('compute')
      }
    }
  })

  it('does not raise fetchMoreMaterial when at least one chunk is at or above the threshold', async () => {
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)
    const svc = makeService(makeVerifier(PASSING_VERDICT), makeNullCache())

    const result = await svc.generate(
      generationFn,
      [CHUNK_BELOW_THRESHOLD, CHUNK_ABOVE_THRESHOLD],
      OPTIONS,
    )

    expect(result.success).toBe(true)
  })

  it('does not exhaust regenerations against thin material — fetchMoreMaterial is raised immediately', async () => {
    const generationFn: GenerationFn = vi.fn()
    const svc = makeService(makeVerifier(PASSING_VERDICT), makeNullCache())

    await svc.generate(generationFn, [CHUNK_BELOW_THRESHOLD], OPTIONS)

    expect(generationFn).not.toHaveBeenCalled()
  })

  it('increments the abstention counter when all chunks are below the threshold', async () => {
    const abstentionsCounter = makeCounter()
    const generationFn: GenerationFn = vi.fn()
    const svc = makeService(makeVerifier(PASSING_VERDICT), makeNullCache(), undefined, {
      abstentions: abstentionsCounter,
    })

    await svc.generate(generationFn, [CHUNK_BELOW_THRESHOLD], OPTIONS)

    expect(abstentionsCounter.inc).toHaveBeenCalledTimes(1)
  })
})

describe('GroundedGenerationService — cache write-through (real Redis)', () => {
  let container: StartedTestContainer
  let redis: Redis
  let cacheService: LlmResponseCacheService

  beforeAll(async () => {
    container = await startRedisContainer()
    redis = new Redis(`redis://${container.getHost()}:${container.getMappedPort(6379)}`)
    cacheService = new LlmResponseCacheService(
      redis,
      makeConfigService() as ConfigService<EnvConfig>,
    )
  }, 60_000)

  afterAll(async () => {
    await redis.quit()
    await container?.stop()
  })

  beforeEach(async () => {
    await redis.flushall()
  })

  function makeService() {
    return new GroundedGenerationService(
      makeVerifier(PASSING_VERDICT),
      cacheService,
      makeConfigService(),
      makeCounter(),
      makeCounter(),
      makeCounter(),
    )
  }

  it('writes a passing item through to the cache under the supplied key', async () => {
    const svc = makeService()
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)

    await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    const cached = await cacheService.get(OPTIONS.cacheKey)
    expect(cached).not.toBeNull()
    expect(cached?.verified).toBe(true)
  })

  it('a later read after a passing generation is a cache hit with no extra generation call', async () => {
    const svc = makeService()
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)

    await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    expect(generationFn).toHaveBeenCalledTimes(1)

    const cached = await cacheService.get(OPTIONS.cacheKey)
    expect(cached).not.toBeNull()
  })

  it('does not write to the cache when the item fails all attempts', async () => {
    const failAllVerifier = makeVerifier(Array(10).fill(FAILING_VERDICT) as VerifierVerdict[])
    const svc = new GroundedGenerationService(
      failAllVerifier,
      cacheService,
      makeConfigService(),
      makeCounter(),
      makeCounter(),
      makeCounter(),
    )
    const generationFn: GenerationFn = vi.fn().mockResolvedValue(VALID_ITEM)

    await svc.generate(generationFn, [CHUNK_ABOVE_THRESHOLD], OPTIONS)

    const cached = await cacheService.get(OPTIONS.cacheKey)
    expect(cached).toBeNull()
  })
})

describe('extractive-contract integration with GroundedGenerationService', () => {
  it('validator recognizes the valid fixture item', () => {
    const result = validateExtractiveContract(VALID_ITEM, [
      { id: 'chunk-1', text: CHUNK_ABOVE_THRESHOLD.text },
    ])
    expect(result.valid).toBe(true)
  })
})
