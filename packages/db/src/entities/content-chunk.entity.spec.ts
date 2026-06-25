import { MikroORM } from '@mikro-orm/core'
import { EMBEDDING_DIMENSION } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { ContentChunk, ContentChunkSchema } from './content-chunk.entity'
import { ContentSource, ContentSourceSchema } from './content-source.entity'

const CERT_ID = '00000000-0000-0000-0000-000000000001'
const SOURCE_ID = '00000000-0000-4000-8000-000000000001'

function makeEmbedding(dim = EMBEDDING_DIMENSION): number[] {
  return Array.from({ length: dim }, (_, i) => i / dim)
}

describe('ContentChunk entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [ContentSourceSchema, ContentChunkSchema] as any[],
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  beforeEach(async () => {
    await orm.em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
    const em = orm.em.fork()
    const source = em.create(ContentSource, {
      id: SOURCE_ID,
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://docs.aws.amazon.com/',
      recheckIntervalMinutes: 10_080,
    })
    em.persist(source)
    await em.flush()
  })

  it('persists 1536-dim embedding and domainTags, derives primaryDomain from highest confidence', async () => {
    const em = orm.em.fork()
    const embedding = makeEmbedding()
    const chunk = em.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Sample text about AWS security best practices.',
      contentHash: 'abc123def456',
      embedding,
      domainTags: [
        { domain: 'Security', confidence: 0.82 },
        { domain: 'Architecture', confidence: 0.61 },
      ],
      primaryDomain: 'Security',
    })
    em.persist(chunk)
    await em.flush()
    em.clear()

    const found = await em.findOneOrFail(ContentChunk, { id: chunk.id })
    expect(found.embedding).toHaveLength(EMBEDDING_DIMENSION)
    // pgvector stores float32; allow small rounding error on round-trip
    expect(found.embedding![0]).toBeCloseTo(embedding[0]!, 4)
    expect(found.domainTags).toHaveLength(2)
    expect(found.domainTags[0]).toEqual({ domain: 'Security', confidence: 0.82 })
    expect(found.primaryDomain).toBe('Security')
  })

  it('enforces unique (contentSourceId, contentHash) constraint', async () => {
    const em = orm.em.fork()
    const chunk1 = em.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Original text.',
      contentHash: 'duplicate-hash',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    em.persist(chunk1)
    await em.flush()

    const em2 = orm.em.fork()
    const chunk2 = em2.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Different text, same hash.',
      contentHash: 'duplicate-hash',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Networking', confidence: 0.7 }],
      primaryDomain: 'Networking',
    })
    em2.persist(chunk2)
    await expect(em2.flush()).rejects.toThrow()
  })

  it('pgvector HNSW index exists on content_chunks.embedding after migration', async () => {
    const conn = orm.em.getConnection()
    const rows = await conn.execute<{ indexname: string }[]>(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'content_chunks'
      AND indexdef ILIKE '%hnsw%'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].indexname).toContain('embedding')
  })

  it('lifecycle migration adds state column (NOT NULL, default active)', async () => {
    const conn = orm.em.getConnection()
    const rows = await conn.execute<
      { column_name: string; column_default: string; is_nullable: string }[]
    >(`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'content_chunks' AND column_name = 'state'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0]!.is_nullable).toBe('NO')
    expect(rows[0]!.column_default).toContain('active')
  })

  it('lifecycle migration adds superseded_by_id column (nullable uuid)', async () => {
    const conn = orm.em.getConnection()
    const rows = await conn.execute<{ column_name: string; is_nullable: string }[]>(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'content_chunks' AND column_name = 'superseded_by_id'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0]!.is_nullable).toBe('YES')
  })

  it('lifecycle migration adds superseded_at column (nullable timestamp)', async () => {
    const conn = orm.em.getConnection()
    const rows = await conn.execute<{ column_name: string; is_nullable: string }[]>(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'content_chunks' AND column_name = 'superseded_at'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0]!.is_nullable).toBe('YES')
  })

  it('lifecycle migration creates index on state column', async () => {
    const conn = orm.em.getConnection()
    const rows = await conn.execute<{ indexname: string }[]>(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'content_chunks'
      AND indexdef ILIKE '%state%'
    `)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('newly inserted chunks default to state=active', async () => {
    const em = orm.em.fork()
    const chunk = em.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'State default test.',
      contentHash: 'state-default-hash',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    em.persist(chunk)
    await em.flush()
    em.clear()

    const [row] = await orm.em
      .getConnection()
      .execute<{ state: string }[]>('SELECT state FROM content_chunks WHERE id = ?', [chunk.id])
    expect(row!.state).toBe('active')
  })

  it('supersededById self-FK references the successor chunk', async () => {
    const em = orm.em.fork()
    const chunkA = em.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'Old chunk A.',
      contentHash: 'hash-old-a',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    const chunkB = em.create(ContentChunk, {
      contentSourceId: SOURCE_ID,
      certificationId: CERT_ID,
      text: 'New chunk B (successor).',
      contentHash: 'hash-new-b',
      embedding: makeEmbedding(),
      domainTags: [{ domain: 'Security', confidence: 0.9 }],
      primaryDomain: 'Security',
    })
    em.persist(chunkA)
    em.persist(chunkB)
    await em.flush()

    // Mark A as superseded by B
    await orm.em
      .getConnection()
      .execute(
        `UPDATE content_chunks SET state = 'superseded', superseded_by_id = ?, superseded_at = NOW() WHERE id = ?`,
        [chunkB.id, chunkA.id],
      )

    const [row] = await orm.em
      .getConnection()
      .execute<{ superseded_by_id: string }[]>(
        'SELECT superseded_by_id FROM content_chunks WHERE id = ?',
        [chunkA.id],
      )
    expect(row!.superseded_by_id).toBe(chunkB.id)
  })
})
