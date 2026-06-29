import { type EntityManager, MikroORM } from '@mikro-orm/core'
import { ConfigService } from '@nestjs/config'
import { QuarantinedItem, startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { Provenance } from '@readion/shared'
import Redis from 'ioredis'
import type { Counter } from 'prom-client'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { LlmResponseCacheService, type VerifiedPayload } from '../llm/llm-response-cache.service'
import { QuarantineService } from './quarantine.service'

const CERT_ID = '00000000-0000-4000-8000-000000000001'
const CACHE_KEY = 'quarantine-persist-key'
const DOMAIN = 'compute'

const PROVENANCE: Provenance = {
  sourceChunkIds: ['chunk-1'],
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  verdict: { pass: false, score: 0.2, distractorFindings: [] },
  score: 0.2,
}

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

describe('QuarantineService persistence (real Postgres + Redis)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let redis: Redis
  let orm: MikroORM
  let em: EntityManager
  let cacheService: LlmResponseCacheService

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])

    const dbHost = postgresContainer.getHost()
    const dbPort = postgresContainer.getMappedPort(5432)
    const redisHost = redisContainer.getHost()
    const redisPort = redisContainer.getMappedPort(6379)

    await acquireIsolatedDatabase()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: dbHost,
      port: dbPort,
      dbName: process.env.DB_NAME ?? 'readion_test',
    })
    await orm.migrator.up()
    em = orm.em

    redis = new Redis(`redis://${redisHost}:${redisPort}`)
    cacheService = new LlmResponseCacheService(redis, makeConfigService())
  }, 120_000)

  afterAll(async () => {
    await redis.quit()
    await orm?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await redis.flushall()
    await orm.em.getConnection().execute('TRUNCATE TABLE quarantined_items CASCADE')
  })

  it('writes a pending QuarantinedItem while still evicting cache and incrementing the metric', async () => {
    const counter = makeCounter()
    const service = new QuarantineService(cacheService, counter, em)
    await cacheService.set(CACHE_KEY, [], VERIFIED_PAYLOAD)

    const record = await service.quarantine(CACHE_KEY, PROVENANCE, 'user-report', CERT_ID, DOMAIN)

    expect(await cacheService.get(CACHE_KEY)).toBeNull()
    expect(counter.inc).toHaveBeenCalledWith(expect.objectContaining({ certification: CERT_ID }))
    expect(record.cacheKey).toBe(CACHE_KEY)

    const persisted = await em.fork().find(QuarantinedItem, {})
    expect(persisted).toHaveLength(1)
    const row = persisted[0]
    expect(row.status).toBe('pending')
    expect(row.certificationId).toBe(CERT_ID)
    expect(row.domain).toBe(DOMAIN)
    expect(row.reason).toBe('user-report')
    expect(row.cacheKey).toBe(CACHE_KEY)
    expect(row.verdict).toBe(JSON.stringify(PROVENANCE.verdict))
    expect(row.provenance).toEqual(PROVENANCE)
    expect(row.generatedContent).toBeNull()
  })
})
