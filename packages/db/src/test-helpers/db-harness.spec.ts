import { defineEntity, type EntitySchema, p } from '@mikro-orm/core'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BaseEntity, BaseSchema } from '../entities/base.entity'
import { createDbHarness, type DbHarness } from './db-harness'

const HarnessTestItemSchema = defineEntity({
  name: 'HarnessTestItem',
  tableName: 'harness_test_items',
  extends: BaseSchema,
  properties: {
    label: p.string(),
  },
}) as EntitySchema

class HarnessTestItem extends BaseEntity {
  label!: string
}
HarnessTestItemSchema.setClass(HarnessTestItem)

describe('DB Harness', () => {
  let harness: DbHarness

  beforeAll(async () => {
    harness = await createDbHarness([HarnessTestItemSchema])
  }, 120_000)

  afterAll(async () => {
    await harness.teardown()
  })

  afterEach(async () => {
    await harness.resetState()
  })

  it('boots a migrated database with vector extension', async () => {
    const em = harness.getEm()
    const rows = await em
      .getConnection()
      .execute<{ extname: string }[]>("SELECT extname FROM pg_extension WHERE extname = 'vector'")
    expect(rows).toHaveLength(1)
  })

  it('provides a fresh EntityManager fork per call', () => {
    const em1 = harness.getEm()
    const em2 = harness.getEm()
    expect(em1).not.toBe(em2)
  })

  it('forks have independent identity maps', async () => {
    const em1 = harness.getEm()
    const item = em1.create(HarnessTestItem, { label: 'a' })
    em1.persist(item)
    await em1.flush()

    const em2 = harness.getEm()
    const count = await em2.count(HarnessTestItem)
    expect(count).toBe(1)
  })

  it('resetState truncates non-bookkeeping tables', async () => {
    const em = harness.getEm()
    const item = em.create(HarnessTestItem, { label: 'to-be-deleted' })
    em.persist(item)
    await em.flush()

    await harness.resetState()

    const em2 = harness.getEm()
    const count = await em2.count(HarnessTestItem)
    expect(count).toBe(0)
  })

  it('migrations bookkeeping table is preserved after reset', async () => {
    await harness.resetState()
    const em = harness.getEm()
    const rows = await em
      .getConnection()
      .execute<{ tablename: string }[]>(
        "SELECT tablename FROM pg_tables WHERE tablename = 'mikro_orm_migrations'",
      )
    expect(rows).toHaveLength(1)
  })
})
