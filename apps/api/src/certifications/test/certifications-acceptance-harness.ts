import 'reflect-metadata'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type { StartedTestContainer } from 'testcontainers'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'

export type CertificationsAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
}

export async function createCertificationsAcceptanceHarness(): Promise<CertificationsAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureCertificationsTestEnv(postgresContainer, redisContainer)

  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    host: postgresContainer.getHost(),
    port: postgresContainer.getMappedPort(5432),
    dbName: 'readion_test',
  })
  await orm.migrator.up()
  await orm.close()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const em = moduleRef.get(EntityManager)

  return {
    app,
    moduleRef,
    resetState: async () => {
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
  }
}

async function truncateDomainTables(em: EntityManager) {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables: { tablename: string }[] = await conn.execute(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)

  if (tables.length === 0) {
    return
  }

  const names = tables.map((table) => `"${table.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}

function configureCertificationsTestEnv(
  postgresContainer: StartedTestContainer,
  redisContainer: StartedTestContainer,
) {
  const dbHost = postgresContainer.getHost()
  const dbPort = postgresContainer.getMappedPort(5432)
  const redisHost = redisContainer.getHost()
  const redisPort = redisContainer.getMappedPort(6379)

  process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
  process.env.DB_HOST = dbHost
  process.env.DB_PORT = String(dbPort)
  process.env.DB_NAME = 'readion_test'
  process.env.DB_USER = 'readion'
  process.env.DB_PASSWORD = 'readion'
  process.env.PORT = '0'
  process.env.NODE_ENV = 'test'
  process.env.CORS_ORIGIN = 'http://localhost:3000'
  process.env.MAIL_FROM = 'Readion <no-reply@readion.app>'
  process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters'
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS = '900'
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS = '604800'
  process.env.BCRYPT_COST = '4'
  process.env.WEB_BASE_URL = 'http://localhost:3000'
}
