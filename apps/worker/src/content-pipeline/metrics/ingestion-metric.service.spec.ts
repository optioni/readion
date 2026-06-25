import { Test } from '@nestjs/testing'
import { createDbHarness, type DbHarness, startRedisContainer } from '@readion/db'
import { register } from 'prom-client'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import { IngestionMetricService } from './ingestion-metric.service'

describe('IngestionMetricService (integration)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let metricService: IngestionMetricService

  beforeAll(async () => {
    const [dbHarness, redis] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redis
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`

    const moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule],
      providers: [IngestionMetricService],
    }).compile()
    await moduleRef.init()

    metricService = moduleRef.get(IngestionMetricService)
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
    await redisContainer?.stop()
  })

  afterEach(() => {
    register.resetMetrics()
  })

  it('increments the chunk-ingestion counter for the given source type', async () => {
    metricService.increment('youtube', 12)

    const metrics = await register.metrics()
    expect(metrics).toContain('content_chunks_ingested_total')
    expect(metrics).toContain('type="youtube"')
  })

  it('increments by the specified count', async () => {
    metricService.increment('youtube', 12)

    const counter = register.getSingleMetric('content_chunks_ingested_total')
    const values = await counter!.get()
    const youtubeValue = values.values.find((v) => v.labels['type'] === 'youtube')
    expect(youtubeValue?.value).toBe(12)
  })
})
