import type { EntityManager, EntitySchema } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/core'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from './containers'

export interface DbHarness {
  orm: MikroORM
  getEm: () => EntityManager
  resetState: () => Promise<void>
  teardown: () => Promise<void>
}

export async function createDbHarness(schemas: EntitySchema[] = []): Promise<DbHarness> {
  const container = await startPostgresContainer()
  const host = container.getHost()
  const port = container.getMappedPort(5432)

  process.env.DB_HOST = host
  process.env.DB_PORT = String(port)
  process.env.DB_NAME = 'readion_test'

  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    entities: schemas,
    discovery: { warnWhenNoEntities: false },
    host,
    port,
    dbName: 'readion_test',
  })

  await orm.migrator.up()

  if (schemas.length > 0) {
    await orm.schema.update({ safe: true })
  }

  return {
    orm,
    getEm: () => orm.em.fork(),
    resetState: async () => {
      const conn = orm.em.getConnection()
      const tables = await conn.execute<{ tablename: string }[]>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename != 'mikro_orm_migrations'
      `)
      if (tables.length > 0) {
        const names = tables.map((t) => `"${t.tablename}"`).join(', ')
        await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
      }
    },
    teardown: async () => {
      await orm.close()
      await container.stop()
    },
  }
}
