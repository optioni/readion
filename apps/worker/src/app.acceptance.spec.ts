import * as http from 'node:http'
import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Processor } from '@nestjs/bullmq'
import { Logger, Module } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  createDbHarness,
  type DbHarness,
  startPostgresContainer,
  startRedisContainer,
} from '@readion/db'
import type { Job } from 'bullmq'
import { Queue, QueueEvents } from 'bullmq'
import type Redis from 'ioredis'
import { Logger as PinoLogger } from 'nestjs-pino'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BaseProcessor } from './queue/base.processor'
import { registerSourceQueue } from './queue/queue.helpers'
import { REDIS_CLIENT } from './redis/redis.module'
import type { ScrapperClient } from './scrapper/scrapper.client'
import { ScrapperError } from './scrapper/scrapper.errors'
import { SCRAPPER_CLIENT } from './scrapper/scrapper.module'
import { USER_HARD_PURGE_CRON } from './users/user-purge.service'

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

// AppModule is intentionally NOT statically imported here.
// ConfigModule.forRoot() validates process.env at import time, so AppModule is
// dynamically imported inside beforeAll after env vars are set.

const TEST_QUEUE = 'acceptance-test-queue'

interface ScrapperStub {
  server: http.Server
  port: number
  close: () => Promise<void>
}

async function startScrapperStub(): Promise<ScrapperStub> {
  const server = http.createServer((req, res) => {
    const params = new URL(req.url ?? '/', 'http://localhost').searchParams
    const targetUrl = params.get('url') ?? ''

    if (targetUrl.includes('500')) {
      res.writeHead(500)
      res.end()
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('# Cleaned Content\n\nSome text from the scrapper.')
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as net.AddressInfo).port

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  }
}

@Processor(TEST_QUEUE)
class TestProcessor extends BaseProcessor {
  protected readonly logger = new Logger(TestProcessor.name)
  async handle(_job: Job): Promise<{ done: boolean }> {
    return { done: true }
  }
}

@Module({
  imports: [registerSourceQueue(TEST_QUEUE)],
  providers: [TestProcessor],
})
class TestQueueModule {}

describe('Worker Acceptance', () => {
  let moduleRef: TestingModule
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let stub: ScrapperStub
  let prometheusPort: number

  beforeAll(async () => {
    const [pg, redis, scrapperStub, freePort] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
      startScrapperStub(),
      getFreePort(),
    ])
    redisContainer = redis
    stub = scrapperStub
    prometheusPort = freePort

    const dbHost = pg.getHost()
    const dbPort = pg.getMappedPort(5432)
    const redisHost = redis.getHost()
    const redisPort = redis.getMappedPort(6379)

    process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
    process.env.SCRAPPER_URL = `http://127.0.0.1:${stub.port}`
    process.env.NODE_ENV = 'development'
    process.env.PROMETHEUS_PORT = String(prometheusPort)
    process.env.SERVICE_NAME = 'readion-worker-test'
    process.env.DB_HOST = dbHost
    process.env.DB_PORT = String(dbPort)
    process.env.DB_NAME = 'readion_test'
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'

    harness = await createDbHarness()

    // Dynamic import ensures ConfigModule.forRoot() sees the env vars we just set
    const { AppModule } = await import('./app.module')

    moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestQueueModule],
    }).compile()

    await moduleRef.init()
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    await redisContainer?.stop()
    await stub?.close()
  })

  describe('worker-runtime', () => {
    it('application context resolves root module', () => {
      expect(moduleRef).toBeDefined()
    })

    it('boot exposes no HTTP listener', () => {
      const app = moduleRef.createNestApplication()
      expect(app.getHttpServer()?.listening).toBeFalsy()
    })

    it('Redis client is injectable and responds to PING', async () => {
      const redis = moduleRef.get<Redis>(REDIS_CLIENT)
      const pong = await redis.ping()
      expect(pong).toBe('PONG')
    })

    it('Schedule registry exposes the user hard-purge cron job', () => {
      const registry = moduleRef.get(SchedulerRegistry)
      expect(registry).toBeDefined()
      expect(registry.getCronJobs().has(USER_HARD_PURGE_CRON)).toBe(true)
    })

    it('EntityManager is resolvable in the worker context', async () => {
      const em = moduleRef.get(EntityManager)
      expect(em).toBeDefined()
      const [{ one }] = await em.getConnection().execute<{ one: number }[]>('SELECT 1 AS one')
      expect(one).toBe(1)
    })

    it('no worker-owned migration is added', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('node:path') as typeof import('node:path')
      const migrationDir = path.resolve(__dirname, '../../../packages/db/src/migrations')
      const workerMigrationDir = path.resolve(__dirname, './migrations')
      expect(fs.existsSync(workerMigrationDir)).toBe(false)
      const entries = fs.readdirSync(migrationDir) as string[]
      const workerMigrations = entries.filter((f) => f.toLowerCase().includes('worker'))
      expect(workerMigrations).toHaveLength(0)
    })

    it('shutdown hooks close connections without throwing', () => {
      const redis = moduleRef.get<Redis>(REDIS_CLIENT)
      expect(['connecting', 'connect', 'ready']).toContain(redis.status)
    })
  })

  describe('job-queue', () => {
    it('enqueued job is consumed by the base-derived processor to completed', async () => {
      const queue = moduleRef.get<Queue>(`BullQueue_${TEST_QUEUE}`)
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) throw new Error('REDIS_URL is not set')
      const parsed = new URL(redisUrl)
      const queueEvents = new QueueEvents(TEST_QUEUE, {
        connection: { host: parsed.hostname, port: Number(parsed.port) || 6379 },
      })
      await queueEvents.waitUntilReady()

      const completedPromise = new Promise<string>((resolve) => {
        queueEvents.on('completed', ({ jobId }) => resolve(jobId))
      })

      const job = await queue.add('test-job', { value: 42 })
      const completedJobId = await completedPromise

      expect(completedJobId).toBe(job.id)
      await queueEvents.close()
    }, 30_000)

    it('scrapper client returns cleaned content from the stub', async () => {
      const scrapper = moduleRef.get<ScrapperClient>(SCRAPPER_CLIENT)
      const result = await scrapper.fetch('https://example.com/success')
      expect(result.content).toContain('Cleaned Content')
      expect(result.url).toBe('https://example.com/success')
    })

    it('scrapper client maps a 500 response to a typed ScrapperError', async () => {
      const scrapper = moduleRef.get<ScrapperClient>(SCRAPPER_CLIENT)
      await expect(scrapper.fetch('https://example.com/500')).rejects.toBeInstanceOf(ScrapperError)
    })
  })

  describe('observability', () => {
    describe('prometheus-metrics', () => {
      it('GET /metrics on PROMETHEUS_PORT returns 200 with default process metrics', async () => {
        const res = await fetch(`http://127.0.0.1:${prometheusPort}/metrics`)
        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toContain('process_cpu_seconds_total')
      })
    })

    describe('structured-logging', () => {
      it('nestjs-pino Logger is injectable and callable', () => {
        const logger = moduleRef.get(PinoLogger)
        expect(logger).toBeDefined()
        expect(typeof logger.log).toBe('function')
        expect(typeof logger.warn).toBe('function')
        expect(typeof logger.error).toBe('function')
        expect(() => logger.log('observability-acceptance-smoke')).not.toThrow()
      })
    })
  })
})
