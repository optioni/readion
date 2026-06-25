import { Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import { contentSourceTypes } from '@readion/shared'
import { Queue, QueueEvents, Worker } from 'bullmq'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { QueueModule } from '../../queue/queue.module'
import { RedisModule } from '../../redis/redis.module'
import { ContentQueuesModule, ingestionQueueName } from './content-queues.module'
import { ContentQueuesService } from './content-queues.service'

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL!
  const url = new URL(redisUrl)
  return { host: url.hostname, port: Number(url.port) || 6379 }
}

describe('ContentQueuesModule (integration)', () => {
  let redisContainer: StartedTestContainer

  beforeAll(async () => {
    redisContainer = await startRedisContainer()
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.SCRAPPER_URL = process.env.SCRAPPER_URL ?? 'http://localhost:3001'
  }, 60_000)

  afterAll(async () => {
    await redisContainer?.stop()
  })

  it('registers a separate queue per source type', async () => {
    @Module({
      imports: [RedisModule, QueueModule, ContentQueuesModule],
      providers: [ContentQueuesService],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()

    for (const type of contentSourceTypes) {
      const queue = moduleRef.get<Queue>(`BullQueue_${ingestionQueueName(type)}`)
      expect(queue).toBeDefined()
      expect(queue.name).toBe(ingestionQueueName(type))
    }

    await moduleRef.close()
  })

  it('high-priority job is processed before normal-priority queued jobs', async () => {
    const queueName = `ingestion-web-priority-test-${Date.now()}`
    const connection = getRedisConnection()
    const processedOrder: string[] = []

    const worker = new Worker(
      queueName,
      async (job) => {
        processedOrder.push(job.data.label as string)
      },
      { connection, autorun: false },
    )

    const queue = new Queue(queueName, { connection })
    const queueEvents = new QueueEvents(queueName, { connection })
    await queueEvents.waitUntilReady()

    // Enqueue low-priority first, then high-priority
    await queue.add('ingest', { label: 'low-1' }, { priority: 10 })
    await queue.add('ingest', { label: 'low-2' }, { priority: 10 })
    await queue.add('ingest', { label: 'high' }, { priority: 1 })

    const completedIds = new Set<string>()
    const allDone = new Promise<void>((resolve) => {
      queueEvents.on('completed', ({ jobId }) => {
        completedIds.add(jobId)
        if (completedIds.size === 3) resolve()
      })
    })

    worker.run()
    await allDone

    // High-priority job should have been processed ahead of the low-priority ones
    const highIdx = processedOrder.indexOf('high')
    expect(highIdx).toBeLessThan(processedOrder.length - 1)

    await worker.close()
    await queue.close()
    await queueEvents.close()
  }, 30_000)

  it('transient failure is retried with exponential backoff', async () => {
    const queueName = `ingestion-retry-test-${Date.now()}`
    const connection = getRedisConnection()
    let callCount = 0

    const worker = new Worker(
      queueName,
      async () => {
        callCount++
        throw new Error('transient error')
      },
      { connection, autorun: false },
    )

    const queue = new Queue(queueName, { connection })
    const queueEvents = new QueueEvents(queueName, { connection })
    await queueEvents.waitUntilReady()

    const failedPromise = new Promise<void>((resolve) => {
      queueEvents.on('failed', () => resolve())
    })

    await queue.add(
      'ingest',
      { contentSourceId: 'x' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10 },
      },
    )

    worker.run()
    await failedPromise

    expect(callCount).toBe(3)

    await worker.close()
    await queue.close()
    await queueEvents.close()
  }, 30_000)
})
