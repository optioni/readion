import { Processor } from '@nestjs/bullmq'
import { Logger, Module } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { startRedisContainer } from '@readion/db'
import type { Job } from 'bullmq'
import { Queue, QueueEvents, Worker } from 'bullmq'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { RedisModule } from '../redis/redis.module'
import { BaseProcessor } from './base.processor'
import { buildDefaultJobOptions } from './queue.defaults'
import { registerSourceQueue } from './queue.helpers'
import { QueueModule } from './queue.module'

function getRedisConnection() {
  const url = new URL(process.env.REDIS_URL!)
  return { host: url.hostname, port: Number(url.port) || 6379 }
}

function uniqueQueue() {
  return `test-queue-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('QueueModule integration', () => {
  let redisContainer: StartedTestContainer

  beforeAll(async () => {
    redisContainer = await startRedisContainer()
    const host = redisContainer.getHost()
    const port = redisContainer.getMappedPort(6379)
    process.env.REDIS_URL = `redis://${host}:${port}`
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.SCRAPPER_URL = process.env.SCRAPPER_URL ?? 'http://localhost:3001'
  }, 60_000)

  afterAll(async () => {
    await redisContainer?.stop()
  })

  describe('Queues use the shared connection', () => {
    it('a job added to a helper-registered queue is readable from the same Redis instance', async () => {
      const queueName = uniqueQueue()

      @Module({
        imports: [RedisModule, QueueModule, registerSourceQueue(queueName)],
      })
      class TestModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [TestModule],
      }).compile()

      const queue = moduleRef.get<Queue>(`BullQueue_${queueName}`)
      const job = await queue.add('task', { x: 1 })

      const waiting = await queue.getWaiting()
      expect(waiting.some((j) => j.id === job.id)).toBe(true)

      await moduleRef.close()
    })
  })

  describe('A failing job is retried before being marked failed', () => {
    it('retries 3 times before marking failed with attemptsMade=3', async () => {
      const queueName = uniqueQueue()
      const connection = getRedisConnection()
      let callCount = 0

      const worker = new Worker(
        queueName,
        async () => {
          callCount++
          throw new Error('always fails')
        },
        { connection, autorun: false },
      )

      const queue = new Queue(queueName, { connection })
      const queueEvents = new QueueEvents(queueName, { connection })
      await queueEvents.waitUntilReady()
      await queue.waitUntilReady()

      const defaultOpts = buildDefaultJobOptions({ backoffDelayMs: 10 })
      const failedPromise = new Promise<{ jobId: string; failedReason: string }>((resolve) => {
        queueEvents.on('failed', ({ jobId, failedReason }) => resolve({ jobId, failedReason }))
      })

      const job = await queue.add(
        'task',
        {},
        { ...defaultOpts, attempts: 3, backoff: { type: 'exponential', delay: 10 } },
      )
      worker.run()

      const { jobId, failedReason } = await failedPromise
      expect(jobId).toBe(job.id)
      expect(failedReason).toContain('always fails')
      expect(callCount).toBe(3)

      const finishedJob = await queue.getJob(job.id!)
      expect(finishedJob?.attemptsMade).toBe(3)

      await worker.close()
      await queue.close()
      await queueEvents.close()
    }, 30_000)
  })

  describe('Job events', () => {
    it('Completed event fires with the job id', async () => {
      const queueName = uniqueQueue()
      const connection = getRedisConnection()

      const worker = new Worker(queueName, async () => 'done', { connection })
      const queue = new Queue(queueName, { connection })
      const queueEvents = new QueueEvents(queueName, { connection })
      await queueEvents.waitUntilReady()

      const completedPromise = new Promise<string>((resolve) => {
        queueEvents.on('completed', ({ jobId }) => resolve(jobId))
      })

      const job = await queue.add('task', {})
      const completedId = await completedPromise
      expect(completedId).toBe(job.id)

      await worker.close()
      await queue.close()
      await queueEvents.close()
    }, 30_000)

    it('Failed event carries the failure reason', async () => {
      const queueName = uniqueQueue()
      const connection = getRedisConnection()

      const worker = new Worker(
        queueName,
        async () => {
          throw new Error('kaboom')
        },
        { connection },
      )
      const queue = new Queue(queueName, { connection })
      const queueEvents = new QueueEvents(queueName, { connection })
      await queueEvents.waitUntilReady()

      const failedPromise = new Promise<{ jobId: string; failedReason: string }>((resolve) => {
        queueEvents.on('failed', ({ jobId, failedReason }) => resolve({ jobId, failedReason }))
      })

      const job = await queue.add('task', {}, { attempts: 1 })
      const { jobId, failedReason } = await failedPromise
      expect(jobId).toBe(job.id)
      expect(failedReason).toContain('kaboom')

      await worker.close()
      await queue.close()
      await queueEvents.close()
    }, 30_000)

    it('Concrete processor consumes an enqueued job end-to-end', async () => {
      const queueName = uniqueQueue()

      @Processor(queueName)
      class E2EProcessor extends BaseProcessor {
        protected readonly logger = new Logger(E2EProcessor.name)
        async handle(_job: Job): Promise<string> {
          return 'processed'
        }
      }

      @Module({
        imports: [RedisModule, QueueModule, registerSourceQueue(queueName)],
        providers: [E2EProcessor],
      })
      class E2EModule {}

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [E2EModule],
      }).compile()
      await moduleRef.init()

      const queue = moduleRef.get<Queue>(`BullQueue_${queueName}`)
      const connection = getRedisConnection()
      const queueEvents = new QueueEvents(queueName, { connection })
      await queueEvents.waitUntilReady()

      const completedPromise = new Promise<string>((resolve) => {
        queueEvents.on('completed', ({ jobId }) => resolve(jobId))
      })

      const job = await queue.add('task', { payload: 'test' })
      const completedId = await completedPromise
      expect(completedId).toBe(job.id)

      await queueEvents.close()
      await moduleRef.close()
    }, 30_000)
  })
})
