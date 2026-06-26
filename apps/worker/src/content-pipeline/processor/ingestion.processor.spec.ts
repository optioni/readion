import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { CertPromotionService, COVERAGE_STATS_QUERY } from '../promotion/cert-promotion.service'
import { ChunkReconciliationService } from '../reconciliation/chunk-reconciliation.service'
import { ContentChunkRepository } from '../repository/content-chunk.repository'
import { ContentSourceRepository } from '../repository/content-source.repository'
import { IngestionService } from './ingestion.service'

describe('IngestionService (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let service: IngestionService
  let sourceRepo: ContentSourceRepository

  const mockStrategyRegistry = {
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue([
        {
          text: 'AWS security best practices for cloud architects.',
          url: 'https://docs.aws.amazon.com/security',
        },
      ]),
    }),
  }
  const mockDomainTagger = {
    tag: vi.fn().mockResolvedValue({
      tags: [{ domain: 'Security', confidence: 0.88 }],
      primaryDomain: 'Security',
    }),
  }
  const mockEmbedder = {
    embedChunks: vi
      .fn()
      .mockResolvedValue([Array.from({ length: 1536 }, (_: unknown, i: number) => i / 1536)]),
  }
  const mockMetrics = {
    increment: vi.fn(),
  }
  const mockReconciliation = {
    reconcile: vi.fn().mockResolvedValue(undefined),
  }

  const mockCertPromotion = {
    evaluateAndPromote: vi.fn().mockResolvedValue(undefined),
  }

  beforeAll(async () => {
    const [dbHarness, redis] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redis
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [
        ContentChunkRepository,
        ContentSourceRepository,
        IngestionService,
        { provide: 'StrategyRegistry', useValue: mockStrategyRegistry },
        { provide: 'DomainTaggerService', useValue: mockDomainTagger },
        { provide: 'EmbedderService', useValue: mockEmbedder },
        { provide: 'IngestionMetricService', useValue: mockMetrics },
        { provide: ChunkReconciliationService, useValue: mockReconciliation },
        {
          provide: COVERAGE_STATS_QUERY,
          useValue: vi.fn().mockResolvedValue({ domains: [], totalChunks: 0 }),
        },
        { provide: CertPromotionService, useValue: mockCertPromotion },
      ],
    }).compile()
    await moduleRef.init()

    service = moduleRef.get(IngestionService)
    sourceRepo = moduleRef.get(ContentSourceRepository)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    const em = service['chunkRepo']['em']
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
  })

  it('runs fetch→chunk→tag→embed→upsert and updates lastFetchedAt', async () => {
    const source = await sourceRepo.create({
      certificationId: '00000000-0000-0000-0000-000000000001',
      type: 'web',
      url: 'https://docs.aws.amazon.com/security',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await service.ingest(source.id, ['Security', 'Architecture'])

    const updatedSource = await sourceRepo.findById(source.id)
    expect(updatedSource?.lastFetchedAt).not.toBeNull()

    const em = service['chunkRepo']['em']
    const count = await em
      .getConnection()
      .execute<{ count: string }[]>(
        'SELECT COUNT(*) as count FROM content_chunks WHERE content_source_id = ?',
        [source.id],
      )
    expect(Number(count[0]?.count)).toBeGreaterThan(0)
  })

  it('logs a warning and returns without error when source is not found', async () => {
    await expect(
      service.ingest('00000000-0000-0000-0000-000000000999', []),
    ).resolves.toBeUndefined()
  })

  it('updates lastFetchedAt and returns when fetch returns no content', async () => {
    mockStrategyRegistry.get.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([]),
    })

    const source = await sourceRepo.create({
      certificationId: '00000000-0000-0000-0000-000000000001',
      type: 'web',
      url: 'https://empty.example.com',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await service.ingest(source.id, [])

    const updatedSource = await sourceRepo.findById(source.id)
    expect(updatedSource?.lastFetchedAt).not.toBeNull()
  })
})
