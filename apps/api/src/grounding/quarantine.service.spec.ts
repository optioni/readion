import type { EntityManager } from '@mikro-orm/core'
import { ConfigService } from '@nestjs/config'
import { startRedisContainer } from '@readion/db'
import type { Provenance } from '@readion/shared'
import Redis from 'ioredis'
import type { Counter } from 'prom-client'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { LlmResponseCacheService, type VerifiedPayload } from '../llm/llm-response-cache.service'
import { GROUNDING_QUARANTINED_ITEMS_METRIC } from './grounding.metrics'
import { QuarantineService } from './quarantine.service'

const PROVENANCE: Provenance = {
  sourceChunkIds: ['chunk-1'],
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  verdict: { pass: true, score: 0.95, distractorFindings: [] },
  score: 0.95,
}

const CACHE_KEY = 'quarantine-test-key'

const VERIFIED_PAYLOAD: VerifiedPayload = {
  text: 'cached item text',
  usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
  verified: true,
}

function makeConfigService(): ConfigService<EnvConfig> {
  return {
    get: vi.fn((key: string) => {
      const vals: Record<string, unknown> = { AI_RESPONSE_CACHE_TTL_SECONDS: 60 }
      return vals[key]
    }),
  } as unknown as ConfigService<EnvConfig>
}

function makeCounter(): Counter {
  return { inc: vi.fn() } as unknown as Counter
}

function makeEntityManager(): EntityManager {
  const fork = {
    create: vi.fn(() => ({})),
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  }
  return { fork: vi.fn(() => fork) } as unknown as EntityManager
}

describe('QuarantineService (real Redis)', () => {
  let container: StartedTestContainer
  let redis: Redis
  let cacheService: LlmResponseCacheService
  let quarantineService: QuarantineService

  beforeAll(async () => {
    container = await startRedisContainer()
    redis = new Redis(`redis://${container.getHost()}:${container.getMappedPort(6379)}`)
    cacheService = new LlmResponseCacheService(redis, makeConfigService())
    quarantineService = new QuarantineService(cacheService, makeCounter(), makeEntityManager())
  }, 60_000)

  afterAll(async () => {
    await redis.quit()
    await container?.stop()
  })

  beforeEach(async () => {
    await redis.flushall()
  })

  it('evicts the cached entry and produces an immutable quarantine record', async () => {
    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)

    const record = await quarantineService.quarantine(CACHE_KEY, PROVENANCE, 'user-report')

    const afterEvict = await cacheService.get(CACHE_KEY)
    expect(afterEvict).toBeNull()
    expect(record.cacheKey).toBe(CACHE_KEY)
    expect(record.provenance).toEqual(PROVENANCE)
    expect(record.reason).toBe('user-report')
    expect(record.quarantinedAt).toBeDefined()
  })

  it('a read after quarantine is a miss', async () => {
    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)
    await quarantineService.quarantine(CACHE_KEY, PROVENANCE, 'auto-flag')

    const result = await cacheService.get(CACHE_KEY)

    expect(result).toBeNull()
  })

  it('user-report and auto-flag go through the same operation producing equivalent records', async () => {
    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)
    const userRecord = await quarantineService.quarantine(CACHE_KEY, PROVENANCE, 'user-report')

    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)
    const autoRecord = await quarantineService.quarantine(CACHE_KEY, PROVENANCE, 'auto-flag')

    expect(userRecord.cacheKey).toBe(autoRecord.cacheKey)
    expect(userRecord.provenance).toEqual(autoRecord.provenance)
    expect(typeof userRecord.quarantinedAt).toBe(typeof autoRecord.quarantinedAt)
  })

  it('increments the quarantined-items metric labelled by certification', async () => {
    const counter = makeCounter()
    const svc = new QuarantineService(cacheService, counter, makeEntityManager())
    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)

    await svc.quarantine(CACHE_KEY, PROVENANCE, 'user-report', 'aws-saa')

    expect(counter.inc).toHaveBeenCalledWith(expect.objectContaining({ certification: 'aws-saa' }))
  })

  it(`uses the ${GROUNDING_QUARANTINED_ITEMS_METRIC} metric name`, () => {
    expect(GROUNDING_QUARANTINED_ITEMS_METRIC).toBe('readion_grounding_quarantined_items_total')
  })
})
