import { EntityManager } from '@mikro-orm/core'
import { Test } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { ContentChunkRepository } from '../repository/content-chunk.repository'
import { ContentQueuesService } from '../queues/content-queues.service'
import { ContentSourceRepository } from '../repository/content-source.repository'
import { StaleSourceCron } from './stale-source.cron'

const CERT_ID = '00000000-0000-0000-0000-000000000001'

describe('StaleSourceCron (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let cron: StaleSourceCron
  let sourceRepo: ContentSourceRepository
  let mockQueuesService: { enqueue: ReturnType<typeof vi.fn> }

  beforeAll(async () => {
    const [dbHarness, redis] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redis
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`

    mockQueuesService = { enqueue: vi.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [
        ContentSourceRepository,
        ContentChunkRepository,
        {
          provide: StaleSourceCron,
          useFactory: (repo: ContentSourceRepository, em: EntityManager) =>
            new StaleSourceCron(repo, mockQueuesService as unknown as ContentQueuesService, em),
          inject: [ContentSourceRepository, EntityManager],
        },
      ],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(StaleSourceCron)
    sourceRepo = moduleRef.get(ContentSourceRepository)
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    const em = sourceRepo['em']
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
    mockQueuesService.enqueue.mockClear()
  })

  it('enqueues re-ingestion job for an enabled stale source', async () => {
    const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://docs.aws.amazon.com/',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await sourceRepo.updateLastFetchedAt(source.id, oldDate)

    await cron.enqueueStaleSourceJobs(new Date())

    expect(mockQueuesService.enqueue).toHaveBeenCalledWith(source.id, 'web', [])
  })

  it('skips a source that was fetched within its recheck interval', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://docs.aws.amazon.com/fresh',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await sourceRepo.updateLastFetchedAt(source.id, new Date())

    await cron.enqueueStaleSourceJobs(new Date())

    expect(mockQueuesService.enqueue).not.toHaveBeenCalled()
  })

  it('skips a stale source that is disabled', async () => {
    const em = sourceRepo['em']
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://disabled.example.com/',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await em
      .getConnection()
      .execute('UPDATE content_sources SET enabled = false, last_fetched_at = ? WHERE id = ?', [
        new Date(0).toISOString(),
        source.id,
      ])

    await cron.enqueueStaleSourceJobs(new Date())

    expect(mockQueuesService.enqueue).not.toHaveBeenCalled()
  })
})
