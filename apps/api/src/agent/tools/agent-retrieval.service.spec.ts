import { createDbHarness, type DbHarness } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AgentRetrievalService } from './agent-retrieval.service'

const SIMILAR = new Array(1536).fill(0.1)
const DISSIMILAR = Array.from({ length: 1536 }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1))

const vectorLiteral = (values: number[]): string => `[${values.join(',')}]`

async function seedCertification(harness: DbHarness, code: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
     VALUES (gen_random_uuid(), 'Cert', 'AWS', ?, '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
     RETURNING id`,
    [code],
  )
  return rows[0]!.id
}

async function seedSource(harness: DbHarness, certId: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'web', ?, 60, now(), now())
     RETURNING id`,
    [certId, `https://test.example.com/${Math.random()}`],
  )
  return rows[0]!.id
}

async function seedChunk(
  harness: DbHarness,
  options: {
    certId: string
    sourceId: string
    domain: string
    embedding: number[]
    state?: string
    text?: string
  },
): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', ?, now(), now())
     RETURNING id`,
    [
      options.sourceId,
      options.certId,
      options.text ?? `Study content for ${options.domain}.`,
      `hash-${Math.random()}`,
      vectorLiteral(options.embedding),
      JSON.stringify([{ domain: options.domain, confidence: 1.0 }]),
      options.domain,
      options.state ?? 'active',
    ],
  )
  return rows[0]!.id
}

describe('AgentRetrievalService', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function service(): AgentRetrievalService {
    if (!harness) throw new Error('DB harness was not initialized')
    return new AgentRetrievalService(harness.getEm())
  }

  it('returns chunks above the threshold ranked and capped to the limit', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-01')
    const sourceId = await seedSource(harness, certId)
    await seedChunk(harness, { certId, sourceId, domain: 'Security', embedding: SIMILAR })
    await seedChunk(harness, { certId, sourceId, domain: 'Security', embedding: SIMILAR })
    await seedChunk(harness, { certId, sourceId, domain: 'Security', embedding: SIMILAR })

    const result = await service().searchChunks(certId, SIMILAR, { threshold: 0.5, limit: 2 })

    expect(result).toHaveLength(2)
    for (const chunk of result) {
      expect(chunk.similarity).toBeGreaterThanOrEqual(0.5)
      expect(chunk.primaryDomain).toBe('Security')
      expect(chunk.sourceUrl).toContain('https://test.example.com/')
    }
  })

  it('excludes chunks whose similarity falls below the threshold', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-02')
    const sourceId = await seedSource(harness, certId)
    const similarId = await seedChunk(harness, {
      certId,
      sourceId,
      domain: 'Security',
      embedding: SIMILAR,
    })
    await seedChunk(harness, { certId, sourceId, domain: 'Networking', embedding: DISSIMILAR })

    const result = await service().searchChunks(certId, SIMILAR, { threshold: 0.5, limit: 10 })

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(similarId)
  })

  it('only returns chunks belonging to the requested certification', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-03')
    const otherCertId = await seedCertification(harness, 'RET-03-OTHER')
    const sourceId = await seedSource(harness, certId)
    const otherSourceId = await seedSource(harness, otherCertId)
    const ownId = await seedChunk(harness, {
      certId,
      sourceId,
      domain: 'Security',
      embedding: SIMILAR,
    })
    await seedChunk(harness, {
      certId: otherCertId,
      sourceId: otherSourceId,
      domain: 'Security',
      embedding: SIMILAR,
    })

    const result = await service().searchChunks(certId, SIMILAR, { threshold: 0.5, limit: 10 })

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(ownId)
  })

  it('excludes non-active chunks', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-04')
    const sourceId = await seedSource(harness, certId)
    await seedChunk(harness, {
      certId,
      sourceId,
      domain: 'Security',
      embedding: SIMILAR,
      state: 'superseded',
    })

    const result = await service().searchChunks(certId, SIMILAR, { threshold: 0.5, limit: 10 })

    expect(result).toHaveLength(0)
  })

  it('getChunksByIds returns an empty array for empty ids', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-05')

    const result = await service().getChunksByIds(certId, [])

    expect(result).toEqual([])
  })

  it('getChunksByIds returns the named chunks for the certification', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const certId = await seedCertification(harness, 'RET-06')
    const sourceId = await seedSource(harness, certId)
    const wantedId = await seedChunk(harness, {
      certId,
      sourceId,
      domain: 'Security',
      embedding: SIMILAR,
      text: 'Wanted chunk text.',
    })
    const otherId = await seedChunk(harness, {
      certId,
      sourceId,
      domain: 'Networking',
      embedding: SIMILAR,
    })

    const result = await service().getChunksByIds(certId, [wantedId])

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(wantedId)
    expect(result[0]!.text).toBe('Wanted chunk text.')
    expect(result[0]!.similarity).toBe(1)
    expect(result.map((c) => c.id)).not.toContain(otherId)
  })
})
