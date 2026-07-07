import * as http from 'node:http'
import * as net from 'node:net'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, startRedisContainer } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { IngestionService } from './processor/ingestion.service'
import { ContentSourceRepository } from './repository/content-source.repository'

const CERT_ID = '00000000-0000-0000-0000-000000000001'
const EMBEDDING_DIM = 1536

function deterministicEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIM }, (_, i) => i / EMBEDDING_DIM)
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

interface ScrapperStub {
  server: http.Server
  port: number
  close: () => Promise<void>
}

const PODCAST_RSS_PATH = '/podcast.rss'

const PODCAST_RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cloud Cert Prep Podcast</title>
    <item>
      <title>Episode 1: IAM Fundamentals</title>
      <guid>episode-1</guid>
      <link>https://example.com/episodes/1</link>
      <description>Show notes: Identity and Access Management covers users, roles, and policies for controlling access to cloud resources.</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Episode 2: Encryption Deep Dive</title>
      <guid>episode-2</guid>
      <link>https://example.com/episodes/2</link>
      <description>Show notes: Encryption at rest and in transit protects data using symmetric and asymmetric key management.</description>
      <pubDate>Mon, 08 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

async function startScrapperStub(): Promise<ScrapperStub> {
  const server = http.createServer((req, res) => {
    if (req.url === PODCAST_RSS_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' })
      res.end(PODCAST_RSS_FIXTURE)
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(
      'AWS Security best practices for cloud infrastructure. Identity and Access Management. ' +
        'Encryption at rest and in transit. Network security controls. Compliance frameworks.',
    )
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

describe('Content Pipeline — Acceptance Test (Outer Loop)', () => {
  let moduleRef: TestingModule
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let stub: ScrapperStub
  let ingestionService: IngestionService
  let sourceRepo: ContentSourceRepository
  let prometheusPort: number
  let metricsService: { increment: ReturnType<typeof vi.fn> }

  beforeAll(async () => {
    const [dbHarness, redis, scrapperStub, freePort] = await Promise.all([
      createDbHarness(),
      startRedisContainer(),
      startScrapperStub(),
      getFreePort(),
    ])
    harness = dbHarness
    redisContainer = redis
    stub = scrapperStub
    prometheusPort = freePort

    const dbHost = process.env.DB_HOST ?? 'localhost'
    const dbPort = process.env.DB_PORT ?? '5432'
    const redisHost = redis.getHost()
    const redisPort = redis.getMappedPort(6379)

    process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
    process.env.SCRAPPER_URL = `http://127.0.0.1:${stub.port}`
    process.env.NODE_ENV = 'development'
    process.env.PROMETHEUS_PORT = String(prometheusPort)
    process.env.SERVICE_NAME = 'readion-worker-test'

    const { AppModule } = await import('../app.module')

    metricsService = { increment: vi.fn() }

    // Build module with mocked LLM gateway (deterministic, boundary-mocked)
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DomainTaggerService')
      .useValue({
        tag: vi.fn().mockResolvedValue({
          tags: [
            { domain: 'Security', confidence: 0.88 },
            { domain: 'Architecture', confidence: 0.62 },
          ],
          primaryDomain: 'Security',
        }),
      })
      .overrideProvider('EmbedderService')
      .useValue({
        embedChunks: vi
          .fn()
          .mockImplementation((texts: string[]) =>
            Promise.resolve(texts.map(() => deterministicEmbedding())),
          ),
      })
      .overrideProvider('IngestionMetricService')
      .useValue(metricsService)
      .compile()

    await moduleRef.init()

    ingestionService = moduleRef.get(IngestionService)
    sourceRepo = moduleRef.get(ContentSourceRepository)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    await redisContainer?.stop()
    await stub?.close()
  })

  it('Full pipeline persists chunks for a source with required fields and updates lastFetchedAt', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'web',
      url: `http://127.0.0.1:${stub.port}/aws-security`,
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    await ingestionService.ingest(source.id, ['Security', 'Architecture', 'Networking'])

    const updatedSource = await sourceRepo.findById(source.id)
    expect(updatedSource?.lastFetchedAt).not.toBeNull()
    expect(updatedSource?.lastFetchedAt).toBeInstanceOf(Date)

    const em = sourceRepo['em']
    const chunks = await em.getConnection().execute<
      {
        content_source_id: string
        certification_id: string
        primary_domain: string
        domain_tags: string
      }[]
    >(
      'SELECT content_source_id, certification_id, primary_domain, domain_tags FROM content_chunks WHERE content_source_id = ?',
      [source.id],
    )

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]!.content_source_id).toBe(source.id)
    expect(chunks[0]!.certification_id).toBe(CERT_ID)
    expect(chunks[0]!.primary_domain).toBe('Security')
    const tags = Array.isArray(chunks[0]!.domain_tags)
      ? chunks[0]!.domain_tags
      : JSON.parse(chunks[0]!.domain_tags as unknown as string)
    expect(tags).toHaveLength(2)
  })

  it('Podcast RSS feed yields per-episode content, persists chunks, and increments the podcast metric', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_ID,
      type: 'podcast',
      url: `http://127.0.0.1:${stub.port}${PODCAST_RSS_PATH}`,
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.podcast,
    })

    await ingestionService.ingest(source.id, ['Security', 'Architecture', 'Networking'])

    const em = sourceRepo['em']
    const chunks = await em.getConnection().execute<
      {
        content_source_id: string
        certification_id: string
      }[]
    >(
      'SELECT content_source_id, certification_id FROM content_chunks WHERE content_source_id = ?',
      [source.id],
    )

    expect(chunks.length).toBeGreaterThan(0)
    expect(metricsService.increment).toHaveBeenCalledWith('podcast', expect.any(Number))
  })
})
