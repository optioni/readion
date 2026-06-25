import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import {
  chunkReverseIndexKey,
  EMBEDDING_DIMENSION,
  SOURCE_RECHECK_INTERVALS,
} from '@readion/shared'
import Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { REDIS_CLIENT } from '../redis/redis.module'
import { SemanticSearchService } from '../semantic-search/semantic-search.service'
import { SupersededChunkCleanupCron } from './cron/superseded-chunk-cleanup.cron'
import { ChunkReconciliationService } from './reconciliation/chunk-reconciliation.service'
import { ContentChunkRepository } from './repository/content-chunk.repository'
import { ContentSourceRepository } from './repository/content-source.repository'
import { ChunkSupersessionService } from './supersession/chunk-supersession.service'

const CERT_ID = '00000000-0000-0000-0000-000000000099'
const DIM = EMBEDDING_DIMENSION

function makeEmbedding(value = 1.0): number[] {
  const raw = Array.from({ length: DIM }, () => value)
  const norm = Math.sqrt(raw.reduce((s, x) => s + x * x, 0))
  return raw.map((x) => x / norm)
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

describe('Chunk Lifecycle — Acceptance Test (Outer Loop)', () => {
  let moduleRef: TestingModule
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let redis: Redis
  let em: EntityManager

  let sourceRepo: ContentSourceRepository
  let chunkRepo: ContentChunkRepository
  let reconciliationService: ChunkReconciliationService
  let supersessionService: ChunkSupersessionService
  let cleanupCron: SupersededChunkCleanupCron
  let searchService: SemanticSearchService

  beforeAll(async () => {
    const [dbHarness, redisC, freePort] = await Promise.all([
      createDbHarness(),
      startRedisContainer(),
      getFreePort(),
    ])
    harness = dbHarness
    redisContainer = redisC

    process.env.REDIS_URL = `redis://${redisC.getHost()}:${redisC.getMappedPort(6379)}`
    process.env.NODE_ENV = 'development'
    process.env.PROMETHEUS_PORT = String(freePort)
    process.env.SERVICE_NAME = 'readion-worker-test'
    process.env.SCRAPPER_URL = 'http://localhost:3001'

    const { AppModule } = await import('../app.module')

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    await moduleRef.init()

    redis = moduleRef.get<Redis>(REDIS_CLIENT)
    em = moduleRef.get(EntityManager)
    sourceRepo = moduleRef.get(ContentSourceRepository)
    chunkRepo = moduleRef.get(ContentChunkRepository)
    reconciliationService = moduleRef.get(ChunkReconciliationService)
    supersessionService = moduleRef.get(ChunkSupersessionService)
    cleanupCron = moduleRef.get(SupersededChunkCleanupCron)
    searchService = moduleRef.get(SemanticSearchService)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
    await redis.flushall()
  })

  it('re-ingestion supersedes a disappeared chunk; lineage set when a single overlapping successor exists', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/doc',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    // Seed initial chunk set: h1 (section=intro), h2 (section=body)
    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Intro content',
      contentHash: 'h1',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: { section: 'intro' },
    })
    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Body content',
      contentHash: 'h2',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: { section: 'body' },
    })

    // Re-ingest: h1 unchanged, h2 disappeared, h3 replaces h2 (same section=body)
    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Body content v2',
      contentHash: 'h3',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: { section: 'body' },
    })

    const now = new Date()
    await reconciliationService.reconcile(source.id, ['h1', 'h3'], now)

    // h2 should be superseded
    const [h2Row] = await em
      .getConnection()
      .execute<{ state: string; superseded_by_id: string | null; superseded_at: string | null }[]>(
        'SELECT state, superseded_by_id, superseded_at FROM content_chunks WHERE content_hash = ?',
        ['h2'],
      )

    expect(h2Row).toBeDefined()
    expect(h2Row!.state).toBe('superseded')
    expect(h2Row!.superseded_at).not.toBeNull()

    // lineage: h3 overlaps h2 (same section=body), so supersededById should point to h3
    const [h3Row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', ['h3'])
    expect(h2Row!.superseded_by_id).toBe(h3Row!.id)

    // h1 should remain active
    const [h1Row] = await em
      .getConnection()
      .execute<{ state: string }[]>('SELECT state FROM content_chunks WHERE content_hash = ?', [
        'h1',
      ])
    expect(h1Row!.state).toBe('active')
  })

  it('cache entries derived from a superseded chunk are evicted', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/cache',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Cached content',
      contentHash: 'hcache',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })

    const [chunkRow] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', ['hcache'])
    const chunkId = chunkRow!.id

    // Manually seed a cache entry with a reverse-index entry for this chunk
    const fakeCacheKey = 'llm:fake-cache-key-abc123'
    await redis.set(fakeCacheKey, '{"text":"quiz question","verified":true}', 'EX', 3600)
    await redis.sadd(chunkReverseIndexKey(chunkId), fakeCacheKey)

    // Verify cache entry exists before supersession
    expect(await redis.get(fakeCacheKey)).not.toBeNull()

    // Supersede the chunk
    await supersessionService.supersede(chunkId, null, new Date())

    // Cache entry should be evicted
    expect(await redis.get(fakeCacheKey)).toBeNull()
    // Reverse-index entry should be pruned
    expect(await redis.smembers(chunkReverseIndexKey(chunkId))).toHaveLength(0)
  })

  it('superseded chunk is excluded from semantic-search retrieval but readable by id', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/search',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    const embedding = makeEmbedding()

    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Active chunk',
      contentHash: 'hactive',
      embedding,
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })
    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Superseded chunk',
      contentHash: 'hsuperseded',
      embedding,
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })

    const [supersededRow] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', [
        'hsuperseded',
      ])
    const supersededId = supersededRow!.id

    await supersessionService.supersede(supersededId, null, new Date())

    // Search should exclude superseded chunk
    const results = await searchService.search(embedding, CERT_ID, { threshold: 0.5 })
    const ids = results.map((r) => r.id)

    expect(ids).not.toContain(supersededId)

    // But it's still readable by direct id lookup
    const [directRow] = await em
      .getConnection()
      .execute<{ id: string; state: string }[]>(
        'SELECT id, state FROM content_chunks WHERE id = ?',
        [supersededId],
      )
    expect(directRow).toBeDefined()
    expect(directRow!.state).toBe('superseded')
  })

  it('cleanup cron hard-deletes superseded chunks past the retention window', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/cleanup',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Old superseded chunk',
      contentHash: 'hold',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })

    const [oldRow] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', ['hold'])
    const oldId = oldRow!.id

    // Supersede it with a past date (past the 30-day window)
    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    await supersessionService.supersede(oldId, null, pastDate)

    // Seed a recently-superseded chunk (within window)
    await chunkRepo.upsertChunk({
      contentSourceId: source.id,
      certificationId: CERT_ID,
      text: 'Recent superseded chunk',
      contentHash: 'hrecent',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })
    const [recentRow] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', [
        'hrecent',
      ])
    await supersessionService.supersede(recentRow!.id, null, new Date())

    // Run the cleanup cron with controlled now
    await cleanupCron.cleanupSupersededChunks(new Date())

    // Old chunk should be deleted
    const [deletedRow] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE id = ?', [oldId])
    expect(deletedRow).toBeUndefined()

    // Recent chunk should still exist
    const [stillExists] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE id = ?', [recentRow!.id])
    expect(stillExists).toBeDefined()
  })
})
