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
import { SupersededChunkCleanupCron } from './superseded-chunk-cleanup.cron'

const CERT_ID = '00000000-0000-0000-0000-000000000077'
const DAY_MS = 24 * 60 * 60 * 1000

function makeEmbedding(): number[] {
  return Array.from({ length: 1536 }, (_, i) => i / 1536)
}

describe('SupersededChunkCleanupCron (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let cron: SupersededChunkCleanupCron
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
        SupersededChunkCleanupCron,
      ],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(SupersededChunkCleanupCron)
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

  it('hard-deletes a superseded chunk older than the retention window', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/cleanup1',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const oldId = await seedChunk(source.id, 'old-chunk')

    // Supersede it 31 days ago
    const pastDate = new Date(Date.now() - 31 * DAY_MS)
    await em
      .getConnection()
      .execute(`UPDATE content_chunks SET state = 'superseded', superseded_at = ? WHERE id = ?`, [
        pastDate.toISOString(),
        oldId,
      ])

    await cron.cleanupSupersededChunks(new Date())

    const [row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE id = ?', [oldId])
    expect(row).toBeUndefined()
  })

  it('retains a superseded chunk within the retention window', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/cleanup2',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const recentId = await seedChunk(source.id, 'recent-chunk')

    // Supersede it just 5 days ago
    const recentDate = new Date(Date.now() - 5 * DAY_MS)
    await em
      .getConnection()
      .execute(`UPDATE content_chunks SET state = 'superseded', superseded_at = ? WHERE id = ?`, [
        recentDate.toISOString(),
        recentId,
      ])

    await cron.cleanupSupersededChunks(new Date())

    const [row] = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM content_chunks WHERE id = ?', [recentId])
    expect(row).toBeDefined()
  })

  it('never deletes active chunks regardless of age', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/cleanup3',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    const activeId = await seedChunk(source.id, 'active-old-chunk')

    // Force created_at to an old date but keep state=active
    await em
      .getConnection()
      .execute(`UPDATE content_chunks SET created_at = ? WHERE id = ?`, [
        new Date(Date.now() - 365 * DAY_MS).toISOString(),
        activeId,
      ])

    await cron.cleanupSupersededChunks(new Date())

    const [row] = await em
      .getConnection()
      .execute<{ id: string; state: string }[]>(
        'SELECT id, state FROM content_chunks WHERE id = ?',
        [activeId],
      )
    expect(row).toBeDefined()
    expect(row!.state).toBe('active')
  })
})
