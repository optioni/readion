import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { chunkReverseIndexKey, SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { REDIS_CLIENT, RedisModule } from '../../redis/redis.module'
import { ContentChunkRepository } from '../repository/content-chunk.repository'
import { ContentSourceRepository } from '../repository/content-source.repository'
import { ChunkSupersessionService } from './chunk-supersession.service'

const CERT_ID = '00000000-0000-0000-0000-000000000055'

function makeEmbedding(): number[] {
  return Array.from({ length: 1536 }, (_, i) => i / 1536)
}

describe('ChunkSupersessionService (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let redis: Redis
  let service: ChunkSupersessionService
  let chunkRepo: ContentChunkRepository
  let sourceRepo: ContentSourceRepository
  let em: EntityManager

  beforeAll(async () => {
    const [dbHarness, redisCtr] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redisCtr
    process.env.REDIS_URL = `redis://${redisCtr.getHost()}:${redisCtr.getMappedPort(6379)}`

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, RedisModule],
      providers: [ContentChunkRepository, ContentSourceRepository, ChunkSupersessionService],
    }).compile()
    await moduleRef.init()

    service = moduleRef.get(ChunkSupersessionService)
    chunkRepo = moduleRef.get(ContentChunkRepository)
    sourceRepo = moduleRef.get(ContentSourceRepository)
    em = moduleRef.get(EntityManager)
    redis = moduleRef.get<Redis>(REDIS_CLIENT)
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

  async function seedChunk(sourceId: string, hash: string): Promise<string> {
    await chunkRepo.upsertChunk({
      contentSourceId: sourceId,
      certificationId: CERT_ID,
      text: `Chunk ${hash}`,
      contentHash: hash,
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })
    const [row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', [hash])
    return row!.id
  }

  it('supersede marks a chunk as superseded with supersededAt set', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/s1',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const chunkId = await seedChunk(source.id, 'hash-to-supersede')
    const now = new Date()

    await service.supersede(chunkId, null, now)

    const [row] = await em.getConnection().execute<
      {
        state: string
        superseded_at: string
        superseded_by_id: string | null
      }[]
    >('SELECT state, superseded_at, superseded_by_id FROM content_chunks WHERE id = ?', [chunkId])
    expect(row!.state).toBe('superseded')
    expect(row!.superseded_at).not.toBeNull()
    expect(row!.superseded_by_id).toBeNull()
  })

  it('supersede sets supersededById when a successor is provided', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/s2',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const oldId = await seedChunk(source.id, 'hash-old')
    const newId = await seedChunk(source.id, 'hash-new')

    await service.supersede(oldId, newId, new Date())

    const [row] = await em
      .getConnection()
      .execute<{ superseded_by_id: string }[]>(
        'SELECT superseded_by_id FROM content_chunks WHERE id = ?',
        [oldId],
      )
    expect(row!.superseded_by_id).toBe(newId)
  })

  it('supersede evicts cached entries for the chunk via the reverse index', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/s3',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const chunkId = await seedChunk(source.id, 'hash-cache-evict')

    // Seed a fake cache entry for this chunk
    const fakeCacheKey = 'llm:fake-key-xyz'
    await redis.set(fakeCacheKey, '{"text":"q","verified":true}', 'EX', 3600)
    await redis.sadd(chunkReverseIndexKey(chunkId), fakeCacheKey)

    await service.supersede(chunkId, null, new Date())

    expect(await redis.get(fakeCacheKey)).toBeNull()
    expect(await redis.smembers(chunkReverseIndexKey(chunkId))).toHaveLength(0)
  })

  it('supersedeAll evicts cache entries for every chunk in the source', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/sa-evict',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const id1 = await seedChunk(source.id, 'sa-evict-c1')
    const id2 = await seedChunk(source.id, 'sa-evict-c2')

    const fakeKey1 = 'llm:sa-fake-1'
    const fakeKey2 = 'llm:sa-fake-2'
    await redis.set(fakeKey1, '{"text":"q","verified":true}', 'EX', 3600)
    await redis.sadd(chunkReverseIndexKey(id1), fakeKey1)
    await redis.set(fakeKey2, '{"text":"r","verified":true}', 'EX', 3600)
    await redis.sadd(chunkReverseIndexKey(id2), fakeKey2)

    await service.supersedeAll(source.id, new Date())

    expect(await redis.get(fakeKey1)).toBeNull()
    expect(await redis.get(fakeKey2)).toBeNull()
  })

  it('supersedeAll marks all active chunks of a source as superseded', async () => {
    const source1 = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/src1',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const source2 = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/src2',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await seedChunk(source1.id, 'src1-c1')
    await seedChunk(source1.id, 'src1-c2')
    await seedChunk(source1.id, 'src1-c3')
    await seedChunk(source2.id, 'src2-c1')

    await service.supersedeAll(source1.id, new Date())

    const src1Rows = await em
      .getConnection()
      .execute<{ state: string }[]>(
        'SELECT state FROM content_chunks WHERE content_source_id = ?',
        [source1.id],
      )
    expect(src1Rows.every((r: { state: string }) => r.state === 'superseded')).toBe(true)

    // Source 2 chunks should remain active
    const src2Rows = await em
      .getConnection()
      .execute<{ state: string }[]>(
        'SELECT state FROM content_chunks WHERE content_source_id = ?',
        [source2.id],
      )
    expect(src2Rows.every((r: { state: string }) => r.state === 'active')).toBe(true)
  })
})
