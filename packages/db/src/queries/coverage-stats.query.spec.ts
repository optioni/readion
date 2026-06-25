import type { EntityManager } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { queryCoverageStats } from './coverage-stats.query'

async function getContainer() {
  return startPostgresContainer()
}

describe('queryCoverageStats', () => {
  let orm: MikroORM
  let em: EntityManager
  let container: Awaited<ReturnType<typeof getContainer>>

  const certId = v4()
  const source1Id = v4()
  const source2Id = v4()
  const source3DisabledId = v4()

  beforeAll(async () => {
    container = await getContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    em = orm.em.fork()
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  afterEach(async () => {
    await em.getConnection().execute('TRUNCATE TABLE content_chunks, content_sources CASCADE')
  })

  async function seedSource(id: string, enabled: boolean) {
    await em.getConnection().execute(
      `INSERT INTO content_sources (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
       VALUES (?, ?, 'web', ?, ?, 1440, NOW(), NOW())`,
      [id, certId, `https://example.com/${id}`, enabled],
    )
  }

  async function seedChunk(
    sourceId: string,
    domainTags: { domain: string; confidence: number }[],
    state: 'active' | 'superseded' = 'active',
    hash?: string,
  ) {
    await em.getConnection().execute(
      `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, domain_tags, primary_domain, metadata, state, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'text', ?, ?::jsonb, ?, '{}'::jsonb, ?, NOW(), NOW())`,
      [
        sourceId,
        certId,
        hash ?? v4(),
        JSON.stringify(domainTags),
        domainTags[0]?.domain ?? 'Unknown',
        state,
      ],
    )
  }

  it('returns per-domain active chunk counts and enabled source counts', async () => {
    await seedSource(source1Id, true)
    await seedSource(source2Id, true)

    // source1 → 2 Security chunks
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }])
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }])

    // source2 → 3 Architecture chunks
    await seedChunk(source2Id, [{ domain: 'Architecture', confidence: 0.8 }])
    await seedChunk(source2Id, [{ domain: 'Architecture', confidence: 0.8 }])
    await seedChunk(source2Id, [{ domain: 'Architecture', confidence: 0.8 }])

    const result = await queryCoverageStats(em, certId)

    expect(result.totalChunks).toBe(5)

    const security = result.domains.find((d) => d.name === 'Security')
    expect(security?.chunkCount).toBe(2)
    expect(security?.enabledSourceCount).toBe(1)

    const architecture = result.domains.find((d) => d.name === 'Architecture')
    expect(architecture?.chunkCount).toBe(3)
    expect(architecture?.enabledSourceCount).toBe(1)
  })

  it('excludes superseded chunks from counts', async () => {
    await seedSource(source1Id, true)

    // 3 active + 2 superseded
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }], 'active', 'h1')
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }], 'active', 'h2')
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }], 'active', 'h3')
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }], 'superseded', 'h4')
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }], 'superseded', 'h5')

    const result = await queryCoverageStats(em, certId)

    expect(result.totalChunks).toBe(3)
    const security = result.domains.find((d) => d.name === 'Security')
    expect(security?.chunkCount).toBe(3)
  })

  it('counts distinct enabled sources per domain and excludes disabled sources', async () => {
    await seedSource(source1Id, true)
    await seedSource(source3DisabledId, false)

    // source1 (enabled) and source3 (disabled) both contribute to Security
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }])
    await seedChunk(source3DisabledId, [{ domain: 'Security', confidence: 0.9 }])

    const result = await queryCoverageStats(em, certId)

    const security = result.domains.find((d) => d.name === 'Security')
    // Only 1 enabled source contributes to Security
    expect(security?.enabledSourceCount).toBe(1)
    // But both chunks are active → chunkCount = 2
    expect(security?.chunkCount).toBe(2)
  })

  it('counts multi-domain chunks toward each tagged domain', async () => {
    await seedSource(source1Id, true)

    // Single chunk tagged to both Security AND Architecture
    await seedChunk(source1Id, [
      { domain: 'Security', confidence: 0.9 },
      { domain: 'Architecture', confidence: 0.7 },
    ])

    const result = await queryCoverageStats(em, certId)

    const security = result.domains.find((d) => d.name === 'Security')
    const architecture = result.domains.find((d) => d.name === 'Architecture')

    expect(security?.chunkCount).toBe(1)
    expect(architecture?.chunkCount).toBe(1)
    // Total active chunks = 1 (the chunk itself)
    expect(result.totalChunks).toBe(1)
  })

  it('returns empty domains array and zero total when no chunks exist', async () => {
    const result = await queryCoverageStats(em, certId)
    expect(result.domains).toHaveLength(0)
    expect(result.totalChunks).toBe(0)
  })

  it('does not return data for a different certificationId', async () => {
    await seedSource(source1Id, true)
    await seedChunk(source1Id, [{ domain: 'Security', confidence: 0.9 }])

    const otherCertId = v4()
    const result = await queryCoverageStats(em, otherCertId)

    expect(result.domains).toHaveLength(0)
    expect(result.totalChunks).toBe(0)
  })
})
