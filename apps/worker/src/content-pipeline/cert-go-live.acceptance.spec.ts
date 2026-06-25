import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, createDbHarness, type DbHarness, startRedisContainer } from '@readion/db'
import { SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { v4 } from 'uuid'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestionService } from './processor/ingestion.service'
import { ContentSourceRepository } from './repository/content-source.repository'

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

describe('cert-go-live — Acceptance Test (Outer Loop)', () => {
  let moduleRef: TestingModule
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let ingestionService: IngestionService
  let sourceRepo: ContentSourceRepository
  let em: EntityManager
  let prometheusPort: number

  const mockFetch = vi.fn()
  const mockTagArchitecture = vi.fn()
  const mockEmbed = vi.fn()

  beforeAll(async () => {
    const [dbHarness, redis, freePort] = await Promise.all([
      createDbHarness(),
      startRedisContainer(),
      getFreePort(),
    ])
    harness = dbHarness
    redisContainer = redis
    prometheusPort = freePort

    const dbHost = process.env.DB_HOST ?? 'localhost'
    const dbPort = process.env.DB_PORT ?? '5432'
    const redisHost = redis.getHost()
    const redisPort = redis.getMappedPort(6379)

    process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
    process.env.SCRAPPER_URL = 'http://localhost:9999'
    process.env.NODE_ENV = 'development'
    process.env.PROMETHEUS_PORT = String(prometheusPort)
    process.env.SERVICE_NAME = 'readion-worker-test'
    // Use minimal thresholds so tests don't need hundreds of chunks
    process.env.CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN = '1'
    process.env.CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE = '1'

    const { AppModule } = await import('../app.module')

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('StrategyRegistry')
      .useValue({
        get: vi.fn().mockReturnValue({ fetch: mockFetch }),
      })
      .overrideProvider('DomainTaggerService')
      .useValue({ tag: mockTagArchitecture })
      .overrideProvider('EmbedderService')
      .useValue({
        embedChunks: mockEmbed,
      })
      .overrideProvider('IngestionMetricService')
      .useValue({ increment: vi.fn() })
      .compile()

    await moduleRef.init()

    ingestionService = moduleRef.get(IngestionService)
    sourceRepo = moduleRef.get(ContentSourceRepository)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await em
      .getConnection()
      .execute('TRUNCATE TABLE content_chunks, content_sources, certifications CASCADE')
    mockFetch.mockReset()
    mockTagArchitecture.mockReset()
    mockEmbed.mockReset()
  })

  async function seedCert(state: 'draft' | 'live') {
    const fork = em.fork()
    const cert = fork.create(Certification, {
      name: 'Test Cert',
      provider: 'AWS',
      code: `TEST-${v4().slice(0, 8)}`,
      domains: [
        { name: 'Security', weight: 50 },
        { name: 'Architecture', weight: 50 },
      ],
      questionCount: 1,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state,
    })
    fork.persist(cert)
    await fork.flush()
    return cert
  }

  async function seedChunk(
    sourceId: string,
    certId: string,
    domain: string,
    hash: string,
  ): Promise<void> {
    await em.getConnection().execute(
      `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, domain_tags, primary_domain, metadata, state, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'text', ?, ?::jsonb, ?, '{}'::jsonb, 'active', NOW(), NOW())`,
      [sourceId, certId, hash, JSON.stringify([{ domain, confidence: 0.9 }]), domain],
    )
  }

  it('Ingestion that completes the bar promotes the cert to live', async () => {
    const cert = await seedCert('draft')

    // source1: already-ingested — contributes 1 chunk to Security
    const source1 = await sourceRepo.create({
      certificationId: cert.id,
      type: 'web',
      url: 'https://example.com/security',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })
    await seedChunk(source1.id, cert.id, 'Security', 'sec-hash-1')

    // source2: new source being ingested, will bring Architecture coverage
    const source2 = await sourceRepo.create({
      certificationId: cert.id,
      type: 'web',
      url: 'https://example.com/architecture',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    mockFetch.mockResolvedValue([
      { text: 'AWS Architecture best practices.', url: 'https://example.com/architecture' },
    ])
    mockTagArchitecture.mockResolvedValue({
      tags: [{ domain: 'Architecture', confidence: 0.9 }],
      primaryDomain: 'Architecture',
    })
    mockEmbed.mockResolvedValue([deterministicEmbedding()])

    await ingestionService.ingest(source2.id, ['Security', 'Architecture'])

    const fork = em.fork()
    const updatedCert = await fork.findOne(Certification, { id: cert.id })
    expect(updatedCert?.state).toBe('live')
  })

  it('Ingestion that does not complete the bar leaves the cert draft', async () => {
    const cert = await seedCert('draft')

    // Only Security domain has a source; Architecture still has zero chunks
    const source1 = await sourceRepo.create({
      certificationId: cert.id,
      type: 'web',
      url: 'https://example.com/security',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    mockFetch.mockResolvedValue([
      { text: 'Security only content.', url: 'https://example.com/security' },
    ])
    // Tagger returns only Security tags — Architecture never gets covered
    mockTagArchitecture.mockResolvedValue({
      tags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    mockEmbed.mockResolvedValue([deterministicEmbedding()])

    await ingestionService.ingest(source1.id, ['Security', 'Architecture'])

    const fork = em.fork()
    const updatedCert = await fork.findOne(Certification, { id: cert.id })
    expect(updatedCert?.state).toBe('draft')
  })

  it('A live certification is never demoted by re-evaluation', async () => {
    const cert = await seedCert('live')

    // Even if bar is not met, live cert stays live
    const source1 = await sourceRepo.create({
      certificationId: cert.id,
      type: 'web',
      url: 'https://example.com/security',
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    mockFetch.mockResolvedValue([{ text: 'Some content.', url: 'https://example.com/security' }])
    // Only covers Security — Architecture domain still has no chunks
    mockTagArchitecture.mockResolvedValue({
      tags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    mockEmbed.mockResolvedValue([deterministicEmbedding()])

    await ingestionService.ingest(source1.id, ['Security', 'Architecture'])

    const fork = em.fork()
    const updatedCert = await fork.findOne(Certification, { id: cert.id })
    expect(updatedCert?.state).toBe('live')
  })
})
