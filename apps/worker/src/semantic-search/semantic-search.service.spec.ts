import { Test } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule, startRedisContainer } from '@readion/db'
import { EMBEDDING_DIMENSION, SOURCE_RECHECK_INTERVALS } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import type { ChunkSearchResult } from '../content-pipeline/repository/content-chunk.repository'
import { ContentChunkRepository } from '../content-pipeline/repository/content-chunk.repository'
import { ContentSourceRepository } from '../content-pipeline/repository/content-source.repository'
import { SemanticSearchService } from './semantic-search.service'

const CERT_A = '00000000-0000-0000-0000-000000000001'
const CERT_B = '00000000-0000-0000-0000-000000000002'

function makeEmbedding(value: number, dim = EMBEDDING_DIMENSION): number[] {
  return Array.from({ length: dim }, () => value)
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return v
  return v.map((x) => x / norm)
}

describe('SemanticSearchService (integration with real pgvector)', () => {
  let harness: DbHarness
  let redisContainer: StartedTestContainer
  let service: SemanticSearchService
  let chunkRepo: ContentChunkRepository
  let sourceRepo: ContentSourceRepository

  beforeAll(async () => {
    const [dbHarness, redis] = await Promise.all([createDbHarness(), startRedisContainer()])
    harness = dbHarness
    redisContainer = redis
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`

    const moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [ContentChunkRepository, ContentSourceRepository, SemanticSearchService],
    }).compile()
    await moduleRef.init()

    service = moduleRef.get(SemanticSearchService)
    chunkRepo = moduleRef.get(ContentChunkRepository)
    sourceRepo = moduleRef.get(ContentSourceRepository)
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    const em = chunkRepo['em']
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
  })

  async function createSourceAndChunks(
    certId: string,
    chunks: Array<{
      text: string
      embedding: number[]
      domainTags: Array<{ domain: string; confidence: number }>
    }>,
  ) {
    const source = await sourceRepo.create({
      certificationId: certId,
      type: 'web',
      url: `https://example.com/${certId}`,
      recheckIntervalMinutes: SOURCE_RECHECK_INTERVALS.web,
    })

    for (const chunk of chunks) {
      await chunkRepo.upsertChunk({
        contentSourceId: source.id,
        certificationId: certId,
        text: chunk.text,
        contentHash: Buffer.from(chunk.text).toString('hex').slice(0, 64),
        embedding: chunk.embedding,
        domainTags: chunk.domainTags,
        primaryDomain: chunk.domainTags[0]?.domain ?? 'unknown',
        metadata: {},
      })
    }
    return source
  }

  it('returns chunks ranked by cosine similarity with provenance', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Security best practices',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
      {
        text: 'Networking concepts',
        embedding: normalize(makeEmbedding(0.1)),
        domainTags: [{ domain: 'Networking', confidence: 0.9 }],
      },
    ])

    const queryEmbedding = normalize(makeEmbedding(1.0))
    const results = await service.search(queryEmbedding, CERT_A, { threshold: 0.5 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.text).toContain('Security best practices')
    expect(results[0]!.sourceUrl).toBe(`https://example.com/${CERT_A}`)
    expect(results[0]!.contentSourceId).toBeDefined()
    expect(results[0]!.primaryDomain).toBe('Security')
  })

  it('scopes results to the queried certification only', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Cert A content',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
    ])
    await createSourceAndChunks(CERT_B, [
      {
        text: 'Cert B content',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
    ])

    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A, { threshold: 0.5 })
    expect(results.every((r: ChunkSearchResult) => r.certificationId === CERT_A)).toBe(true)
    expect(results.some((r: ChunkSearchResult) => r.text === 'Cert A content')).toBe(true)
    expect(results.some((r: ChunkSearchResult) => r.text === 'Cert B content')).toBe(false)
  })

  it('discards chunks below the similarity threshold', async () => {
    const orthogonalEmbedding = Array.from({ length: EMBEDDING_DIMENSION }, (_, i) =>
      i === EMBEDDING_DIMENSION - 1 ? 1.0 : 0.0,
    )
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Close match',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
      {
        text: 'Far content',
        embedding: orthogonalEmbedding,
        domainTags: [{ domain: 'Networking', confidence: 0.9 }],
      },
    ])

    // Query uniform vector has cosine ~1/sqrt(1536) ≈ 0.026 against orthogonal; threshold 0.9 should discard it
    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A, { threshold: 0.9 })
    expect(results.some((r: ChunkSearchResult) => r.text === 'Far content')).toBe(false)
  })

  it('filters by domain including non-primary domain tags', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Multi-domain chunk',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [
          { domain: 'Security', confidence: 0.9 },
          { domain: 'Architecture', confidence: 0.7 },
        ],
      },
    ])

    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A, {
      threshold: 0.5,
      domains: ['Architecture'],
    })
    expect(results.some((r: ChunkSearchResult) => r.text === 'Multi-domain chunk')).toBe(true)
  })

  it('excludes chunks not in the filtered domain', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Only security',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
    ])

    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A, {
      threshold: 0.5,
      domains: ['Networking'],
    })
    expect(results.some((r: ChunkSearchResult) => r.text === 'Only security')).toBe(false)
  })

  it('uses config threshold when no threshold option is provided', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Config threshold test',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
    ])

    // No threshold in options — falls back to CONTENT_SIMILARITY_THRESHOLD config (0.75 default)
    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A)
    expect(results.some((r: ChunkSearchResult) => r.text === 'Config threshold test')).toBe(true)
  })

  it('excludes superseded chunks from retrieval results', async () => {
    await createSourceAndChunks(CERT_A, [
      {
        text: 'Active chunk — should appear',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
      {
        text: 'Superseded chunk — should be excluded',
        embedding: normalize(makeEmbedding(1.0)),
        domainTags: [{ domain: 'Security', confidence: 0.9 }],
      },
    ])

    const em = chunkRepo['em']
    // Mark the second chunk as superseded directly in DB
    await em
      .getConnection()
      .execute(
        `UPDATE content_chunks SET state = 'superseded', superseded_at = NOW() WHERE text = ?`,
        ['Superseded chunk — should be excluded'],
      )

    const results = await service.search(normalize(makeEmbedding(1.0)), CERT_A, { threshold: 0.5 })
    expect(results.some((r: ChunkSearchResult) => r.text === 'Active chunk — should appear')).toBe(
      true,
    )
    expect(
      results.some((r: ChunkSearchResult) => r.text === 'Superseded chunk — should be excluded'),
    ).toBe(false)
  })

  it('superseded chunk that ranks above threshold is still excluded from retrieval', async () => {
    const source = await sourceRepo.create({
      certificationId: CERT_A,
      type: 'web',
      url: `https://example.com/${CERT_A}-superseded-high-rank`,
      recheckIntervalMinutes: 10_080,
    })

    const perfectEmbedding = normalize(makeEmbedding(1.0))
    // Insert directly with superseded state to bypass upsert default
    const em = chunkRepo['em']
    await em.getConnection().execute(
      `INSERT INTO content_chunks
         (id, content_source_id, certification_id, text, content_hash, embedding,
          domain_tags, primary_domain, metadata, state, superseded_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?, ?, ?, 'superseded', NOW(), NOW(), NOW())`,
      [
        source.id,
        CERT_A,
        'Superseded high-rank chunk',
        'hash-superseded-high',
        `[${perfectEmbedding.join(',')}]`,
        JSON.stringify([{ domain: 'Security', confidence: 0.9 }]),
        'Security',
        '{}',
      ],
    )

    const results = await service.search(perfectEmbedding, CERT_A, { threshold: 0.5 })
    expect(results.some((r) => r.text === 'Superseded high-rank chunk')).toBe(false)
  })
})
