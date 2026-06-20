import { EntityManager, MikroORM } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DbModule } from './db.module'
import { createDbHarness, type DbHarness } from './test-helpers/db-harness'

describe('DbModule', () => {
  let harness: DbHarness
  let moduleRef: TestingModule

  beforeAll(async () => {
    harness = await createDbHarness()
    moduleRef = await Test.createTestingModule({
      imports: [DbModule],
    }).compile()
  }, 120_000)

  afterAll(async () => {
    await moduleRef.close()
    await harness.teardown()
  })

  it('resolves EntityManager', async () => {
    const em = moduleRef.get(EntityManager)
    expect(em).toBeDefined()
  })

  it('EntityManager can execute a trivial query', async () => {
    const em = moduleRef.get(EntityManager)
    const [{ one }] = await em.getConnection().execute<{ one: number }[]>('SELECT 1 AS one')
    expect(one).toBe(1)
  })

  it('uses the shared MikroORM config as single source', async () => {
    const orm = moduleRef.get(MikroORM)
    expect(orm.config.get('dbName')).toBe(process.env.DB_NAME ?? 'readion')
  })
})
