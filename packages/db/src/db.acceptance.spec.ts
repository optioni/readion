import { defineEntity, type EntitySchema, p } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { validate as uuidValidate, version as uuidVersion } from 'uuid'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DbModule } from './db.module'
import { BaseEntity, BaseSchema } from './entities/base.entity'
import { createDbHarness, type DbHarness } from './test-helpers/db-harness'
import { VectorType } from './types/vector.type'

// Test-only fixture entity — not exported from the package barrel
const FixtureItemSchema = defineEntity({
  name: 'FixtureItem',
  tableName: 'fixture_items',
  extends: BaseSchema,
  properties: {
    embedding: p.type(new VectorType(3)),
  },
}) as EntitySchema

class FixtureItem extends BaseEntity {
  embedding!: number[]
}
FixtureItemSchema.setClass(FixtureItem)

describe('DB Foundation — Acceptance', () => {
  let harness: DbHarness
  let moduleRef: TestingModule

  beforeAll(async () => {
    harness = await createDbHarness([FixtureItemSchema])
    moduleRef = await Test.createTestingModule({
      imports: [DbModule],
    }).compile()
  }, 120_000)

  afterAll(async () => {
    await moduleRef.close()
    await harness.teardown()
  })

  afterEach(async () => {
    await harness.resetState()
  })

  it('DbModule provides a working EntityManager', async () => {
    const { EntityManager } = await import('@mikro-orm/core')
    const em = moduleRef.get(EntityManager)
    const [{ one }] = await em.getConnection().execute<{ one: number }[]>('SELECT 1 AS one')
    expect(one).toBe(1)
  })

  it('vector extension is enabled after migrate-up', async () => {
    const em = harness.getEm()
    const rows = await em
      .getConnection()
      .execute<{ extname: string }[]>("SELECT extname FROM pg_extension WHERE extname = 'vector'")
    expect(rows).toHaveLength(1)
    expect(rows[0].extname).toBe('vector')
  })

  it('domain migrations create the users table', async () => {
    const em = harness.getEm()
    const rows = await em.getConnection().execute<{ tablename: string }[]>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'users'
    `)
    expect(rows).toHaveLength(1)
  })

  it('new entity receives UUID v4 primary key', async () => {
    const em = harness.getEm()
    const item = em.create(FixtureItem, { embedding: [0.1, 0.2, 0.3] })
    em.persist(item)
    await em.flush()
    expect(uuidValidate(item.id)).toBe(true)
    expect(uuidVersion(item.id)).toBe(4)
  })

  it('timestamps populated on insert', async () => {
    const em = harness.getEm()
    const item = em.create(FixtureItem, { embedding: [0.1, 0.2, 0.3] })
    em.persist(item)
    await em.flush()
    expect(item.createdAt).toBeInstanceOf(Date)
    expect(item.updatedAt).toBeInstanceOf(Date)
  })

  it('pgvector literal round-trips to JS array', async () => {
    const em = harness.getEm()
    const item = em.create(FixtureItem, { embedding: [0.1, 0.2, 0.3] })
    em.persist(item)
    await em.flush()
    em.clear()
    const found = await em.findOneOrFail(FixtureItem, { id: item.id })
    expect(found.embedding).toEqual([0.1, 0.2, 0.3])
  })
})
