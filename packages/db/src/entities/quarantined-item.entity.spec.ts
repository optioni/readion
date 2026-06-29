import { MikroORM } from '@mikro-orm/core'
import type { Provenance } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { QuarantinedItem, QuarantinedItemSchema } from './quarantined-item.entity'

describe('QuarantinedItem entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [QuarantinedItemSchema],
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
    await orm.em.getConnection().execute('TRUNCATE TABLE quarantined_items CASCADE')
  })

  const provenance: Provenance = {
    sourceChunkIds: ['chunk-1', 'chunk-2'],
    supportingSpans: ['span text'],
    verdict: { pass: false, score: 0.2, distractorFindings: [] },
    score: 0.2,
  }

  it('migrates the quarantined_items table with the expected columns and nullability', async () => {
    const conn = orm.em.getConnection()
    type ColumnRow = { column_name: string; is_nullable: string; data_type: string }
    const rows: ColumnRow[] = await conn.execute<ColumnRow[]>(
      `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
       WHERE table_name = 'quarantined_items'`,
    )
    const byName = new Map<string, ColumnRow>(rows.map((r) => [r.column_name, r]))

    expect(byName.get('id')?.is_nullable).toBe('NO')
    expect(byName.get('certification_id')?.is_nullable).toBe('NO')
    expect(byName.get('domain')?.is_nullable).toBe('NO')
    expect(byName.get('verdict')?.is_nullable).toBe('NO')
    expect(byName.get('reason')?.is_nullable).toBe('NO')
    expect(byName.get('status')?.is_nullable).toBe('NO')
    expect(byName.get('provenance')?.is_nullable).toBe('NO')
    expect(byName.get('provenance')?.data_type).toBe('jsonb')
    expect(byName.get('cache_key')?.is_nullable).toBe('NO')
    expect(byName.get('generated_content')?.is_nullable).toBe('YES')
    expect(byName.get('generated_content')?.data_type).toBe('jsonb')
    expect(byName.get('created_at')?.is_nullable).toBe('NO')
  })

  it('persists and reads back a quarantined item with status, verdict, and provenance', async () => {
    const em = orm.em.fork()

    const item = em.create(QuarantinedItem, {
      certificationId: '11111111-1111-1111-1111-111111111111',
      domain: 'Networking',
      verdict: 'unsupported',
      reason: 'Answer is not grounded in the cited spans',
      cacheKey: 'quiz:abc123',
      provenance,
      generatedContent: { question: 'What is a VPC?', options: ['a', 'b'] },
    })
    em.persist(item)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(QuarantinedItem, { id: item.id })
    expect(persisted.certificationId).toBe('11111111-1111-1111-1111-111111111111')
    expect(persisted.domain).toBe('Networking')
    expect(persisted.verdict).toBe('unsupported')
    expect(persisted.reason).toBe('Answer is not grounded in the cited spans')
    expect(persisted.cacheKey).toBe('quiz:abc123')
    expect(persisted.status).toBe('pending')
    expect(persisted.provenance).toEqual(provenance)
    expect(persisted.generatedContent).toEqual({ question: 'What is a VPC?', options: ['a', 'b'] })
    expect(persisted.createdAt).toBeInstanceOf(Date)
  })

  it('defaults status to pending and allows approved/rejected', async () => {
    const em = orm.em.fork()

    const approved = em.create(QuarantinedItem, {
      certificationId: '22222222-2222-2222-2222-222222222222',
      domain: 'Security',
      verdict: 'contradicted',
      reason: 'Contradicts source',
      cacheKey: 'quiz:def456',
      provenance,
      generatedContent: null,
      status: 'approved',
    })
    em.persist(approved)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(QuarantinedItem, { id: approved.id })
    expect(persisted.status).toBe('approved')
    expect(persisted.generatedContent).toBeNull()
  })
})
