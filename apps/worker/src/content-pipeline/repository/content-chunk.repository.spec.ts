import { EntityManager } from '@mikro-orm/core'
import { Test } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { EMBEDDING_DIMENSION, SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { ContentChunkRepository } from './content-chunk.repository'

const CERT_ID = '00000000-0000-0000-0000-000000000001'

function makeEmbedding(dim = EMBEDDING_DIMENSION): number[] {
  return Array.from({ length: dim }, (_, i) => i / dim)
}

describe('ContentChunkRepository (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let repo: ContentChunkRepository
  let em: EntityManager

  beforeAll(async () => {
    const [dbHarness, redis] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redis

    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`

    const moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [ContentChunkRepository],
    }).compile()
    await moduleRef.init()

    repo = moduleRef.get(ContentChunkRepository)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    const conn = em.getConnection()
    await conn.execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
    await conn.execute(
      `INSERT INTO content_sources (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
       VALUES ('00000000-0000-4000-8000-000000000001', ?, 'web', 'https://example.com', true, ?, NOW(), NOW())`,
      [CERT_ID, SOURCE_RECHECK_INTERVALS.web],
    )
  })

  const SOURCE_ID = '00000000-0000-4000-8000-000000000001'

  it('upserts chunk on first ingestion', async () => {
    await repo.upsertChunk({
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Hello world',
      contentHash: 'hash1',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })

    const count = await em
      .fork()
      .getConnection()
      .execute<{ count: string }[]>(
        'SELECT COUNT(*) as count FROM content_chunks WHERE content_source_id = ?',
        [SOURCE_ID],
      )
    expect(Number(count[0]?.count)).toBe(1)
  })

  it('unchanged re-ingestion leaves chunk count unchanged (upsert by hash)', async () => {
    const chunk = {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Hello world',
      contentHash: 'same-hash',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    }
    await repo.upsertChunk(chunk)
    await repo.upsertChunk(chunk)

    const count = await em
      .fork()
      .getConnection()
      .execute<{ count: string }[]>(
        'SELECT COUNT(*) as count FROM content_chunks WHERE content_hash = ?',
        ['same-hash'],
      )
    expect(Number(count[0]?.count)).toBe(1)
  })

  it('new hash inserts a new row on re-ingestion', async () => {
    await repo.upsertChunk({
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Original text',
      contentHash: 'hash-a',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata: {},
    })
    await repo.upsertChunk({
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'New text',
      contentHash: 'hash-b',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Networking', confidence: 0.8 }],
      primaryDomain: 'Networking',
      metadata: {},
    })

    const count = await em
      .fork()
      .getConnection()
      .execute<{ count: string }[]>(
        'SELECT COUNT(*) as count FROM content_chunks WHERE content_source_id = ?',
        [SOURCE_ID],
      )
    expect(Number(count[0]?.count)).toBe(2)
  })
})
