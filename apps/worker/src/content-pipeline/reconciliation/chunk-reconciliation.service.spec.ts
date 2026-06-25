import { EntityManager } from '@mikro-orm/core'
import { Test } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { RedisModule } from '../../redis/redis.module'
import { ContentChunkRepository } from '../repository/content-chunk.repository'
import { ContentSourceRepository } from '../repository/content-source.repository'
import { ChunkSupersessionService } from '../supersession/chunk-supersession.service'
import { ChunkReconciliationService } from './chunk-reconciliation.service'

const CERT_ID = '00000000-0000-0000-0000-000000000066'

function makeEmbedding(): number[] {
  return Array.from({ length: 1536 }, (_, i) => i / 1536)
}

describe('ChunkReconciliationService (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let service: ChunkReconciliationService
  let chunkRepo: ContentChunkRepository
  let sourceRepo: ContentSourceRepository
  let em: EntityManager

  beforeAll(async () => {
    const [dbHarness, redisCtr] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redisCtr
    process.env.REDIS_URL = `redis://${redisCtr.getHost()}:${redisCtr.getMappedPort(6379)}`

    const moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, RedisModule],
      providers: [
        ContentChunkRepository,
        ContentSourceRepository,
        ChunkSupersessionService,
        ChunkReconciliationService,
      ],
    }).compile()
    await moduleRef.init()

    service = moduleRef.get(ChunkReconciliationService)
    chunkRepo = moduleRef.get(ContentChunkRepository)
    sourceRepo = moduleRef.get(ContentSourceRepository)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
  })

  async function seedChunk(
    sourceId: string,
    hash: string,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    await chunkRepo.upsertChunk({
      contentSourceId: sourceId,
      certificationId: CERT_ID,
      text: `Chunk ${hash}`,
      contentHash: hash,
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
      metadata,
    })
    const [row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', [hash])
    return row!.id
  }

  it('unchanged hash remains active after reconciliation', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r1',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source.id, 'h1')
    await seedChunk(source.id, 'h2')

    await service.reconcile(source.id, ['h1', 'h2'], new Date())

    const rows = await em
      .getConnection()
      .execute<{ state: string }[]>(
        'SELECT state FROM content_chunks WHERE content_source_id = ?',
        [source.id],
      )
    expect(rows.every((r: { state: string }) => r.state === 'active')).toBe(true)
  })

  it('disappeared hash is marked superseded with supersededAt set', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r2',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source.id, 'h1')
    await seedChunk(source.id, 'h2')
    await seedChunk(source.id, 'h3')

    const now = new Date()
    // h3 disappears in the new fetch
    await service.reconcile(source.id, ['h1', 'h2'], now)

    const [h3Row] = await em
      .getConnection()
      .execute<{ state: string; superseded_at: string }[]>(
        'SELECT state, superseded_at FROM content_chunks WHERE content_hash = ?',
        ['h3'],
      )
    expect(h3Row!.state).toBe('superseded')
    expect(h3Row!.superseded_at).not.toBeNull()
  })

  it('disappeared chunk row still exists (not hard-deleted by reconciliation)', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r3',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source.id, 'gone')

    await service.reconcile(source.id, [], new Date())

    const [row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE content_hash = ?', ['gone'])
    expect(row).toBeDefined()
  })

  it('single overlapping successor sets supersededById via section metadata', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r4',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    // Old chunk: section=intro
    await seedChunk(source.id, 'old-intro', { section: 'intro' })
    // New chunk: same section=intro
    const newId = await seedChunk(source.id, 'new-intro', { section: 'intro' })

    // Re-ingest: only new-intro present
    await service.reconcile(source.id, ['new-intro'], new Date())

    const [oldRow] = await em
      .getConnection()
      .execute<{ superseded_by_id: string }[]>(
        'SELECT superseded_by_id FROM content_chunks WHERE content_hash = ?',
        ['old-intro'],
      )
    expect(oldRow!.superseded_by_id).toBe(newId)
  })

  it('ambiguous/zero successor leaves supersededById null', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r5',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source.id, 'old-no-match', { section: 'unique-section' })
    // New chunks have different sections — no overlap
    await seedChunk(source.id, 'new-a', { section: 'other-a' })
    await seedChunk(source.id, 'new-b', { section: 'other-b' })

    await service.reconcile(source.id, ['new-a', 'new-b'], new Date())

    const [oldRow] = await em
      .getConnection()
      .execute<{ superseded_by_id: string | null }[]>(
        'SELECT superseded_by_id FROM content_chunks WHERE content_hash = ?',
        ['old-no-match'],
      )
    expect(oldRow!.superseded_by_id).toBeNull()
  })

  it('ambiguous successor (two new chunks overlap) leaves supersededById null', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/r6',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source.id, 'old-ambiguous', { section: 'intro' })
    // Two new chunks both match section=intro → ambiguous
    await seedChunk(source.id, 'new-x', { section: 'intro' })
    await seedChunk(source.id, 'new-y', { section: 'intro' })

    await service.reconcile(source.id, ['new-x', 'new-y'], new Date())

    const [oldRow] = await em
      .getConnection()
      .execute<{ superseded_by_id: string | null }[]>(
        'SELECT superseded_by_id FROM content_chunks WHERE content_hash = ?',
        ['old-ambiguous'],
      )
    expect(oldRow!.superseded_by_id).toBeNull()
  })
})
