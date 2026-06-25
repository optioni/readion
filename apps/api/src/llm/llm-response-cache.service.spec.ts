import { ConfigService } from '@nestjs/config'
import { startRedisContainer } from '@readion/db'
import { chunkReverseIndexKey, evictByChunkId } from '@readion/shared'
import Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { buildCacheKey } from './cache-key.builder'
import { LlmResponseCacheService, type VerifiedPayload } from './llm-response-cache.service'

const SHORT_TTL = 1

function makeConfigService(ttl = 60): ConfigService<EnvConfig> {
  const values = { AI_RESPONSE_CACHE_TTL_SECONDS: ttl } as Partial<EnvConfig>
  return {
    get: (key: string) => (values as Record<string, unknown>)[key],
  } as ConfigService<EnvConfig>
}

describe('LlmResponseCacheService (real Redis)', () => {
  let container: StartedTestContainer
  let redis: Redis
  let service: LlmResponseCacheService

  const VERIFIED: VerifiedPayload = {
    text: 'What is Amazon EC2?',
    usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
    verified: true,
  }

  const BASE_KEY_INPUT = {
    certificationId: 'aws-saa',
    chunkIds: ['c1'],
    difficulty: 'medium',
    format: 'mcq',
  }

  beforeAll(async () => {
    container = await startRedisContainer()
    redis = new Redis(`redis://${container.getHost()}:${container.getMappedPort(6379)}`)
    service = new LlmResponseCacheService(redis, makeConfigService())
  }, 60_000)

  afterAll(async () => {
    await redis.quit()
    await container?.stop()
  })

  beforeEach(async () => {
    await redis.flushall()
  })

  it('stores a verified payload and retrieves it by key', async () => {
    const key = buildCacheKey(BASE_KEY_INPUT)
    await service.set(key, BASE_KEY_INPUT.chunkIds, VERIFIED)
    const result = await service.get(key)

    expect(result).not.toBeNull()
    expect(result?.text).toBe(VERIFIED.text)
    expect(result?.verified).toBe(true)
  })

  it('rejects an unverified payload and stores nothing', async () => {
    const key = buildCacheKey(BASE_KEY_INPUT)

    // @ts-expect-error deliberate type violation to test runtime guard
    await expect(service.set(key, [], { ...VERIFIED, verified: false })).rejects.toThrow()

    const result = await service.get(key)
    expect(result).toBeNull()
  })

  it('returns null for a key that was never set', async () => {
    const key = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['never-set'] })
    expect(await service.get(key)).toBeNull()
  })

  it('returns null when key differs from the stored entry', async () => {
    const key1 = buildCacheKey(BASE_KEY_INPUT)
    const key2 = buildCacheKey({ ...BASE_KEY_INPUT, difficulty: 'hard' })

    await service.set(key1, BASE_KEY_INPUT.chunkIds, VERIFIED)
    expect(await service.get(key2)).toBeNull()
  })

  it('evicts an entry so subsequent reads return null within TTL', async () => {
    const key = buildCacheKey(BASE_KEY_INPUT)
    await service.set(key, BASE_KEY_INPUT.chunkIds, VERIFIED)
    await service.evict(key)
    expect(await service.get(key)).toBeNull()
  })

  it('entry expires after the configured TTL', async () => {
    // Create a service with a 1-second TTL
    const shortTtlService = new LlmResponseCacheService(redis, makeConfigService(SHORT_TTL))
    const key = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['ttl-test'] })

    await shortTtlService.set(key, ['ttl-test'], VERIFIED)
    expect(await shortTtlService.get(key)).not.toBeNull()

    await new Promise((resolve) => setTimeout(resolve, SHORT_TTL * 1000 + 500))
    expect(await shortTtlService.get(key)).toBeNull()
  }, 10_000)

  describe('reverse index — write-through and evict-by-chunk-id', () => {
    it('write-through records the cache key under each constituent chunk id', async () => {
      const key = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['c1', 'c2'] })
      await service.set(key, ['c1', 'c2'], VERIFIED)

      expect(await redis.smembers(chunkReverseIndexKey('c1'))).toContain(key)
      expect(await redis.smembers(chunkReverseIndexKey('c2'))).toContain(key)
    })

    it('evict-by-chunk-id removes every derived entry and prunes the index', async () => {
      const key1 = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['evict-c1'], difficulty: 'easy' })
      const key2 = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['evict-c1'], difficulty: 'hard' })
      await service.set(key1, ['evict-c1'], VERIFIED)
      await service.set(key2, ['evict-c1'], VERIFIED)

      await evictByChunkId(redis, 'evict-c1')

      expect(await service.get(key1)).toBeNull()
      expect(await service.get(key2)).toBeNull()
      expect(await redis.smembers(chunkReverseIndexKey('evict-c1'))).toHaveLength(0)
    })

    it('evicting an already-absent chunk id is a no-op', async () => {
      await expect(evictByChunkId(redis, 'never-indexed-chunk')).resolves.not.toThrow()
    })

    it('write-through with no chunk ids stores payload but does not populate index', async () => {
      const key = buildCacheKey({ ...BASE_KEY_INPUT, chunkIds: ['no-index-test'] })
      await service.set(key, [], VERIFIED)

      const result = await service.get(key)
      expect(result).not.toBeNull()
    })
  })
})
