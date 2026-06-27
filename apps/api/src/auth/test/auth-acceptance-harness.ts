import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { type CapturedMailMessage, MAIL_CAPTURED_MESSAGES } from '../../mail/transport'
import { REDIS_CLIENT } from '../../redis/redis.module'

export class ControllableClock {
  private current = new Date('2026-01-01T00:00:00.000Z')

  now() {
    return new Date(this.current)
  }

  advanceBy(milliseconds: number) {
    this.current = new Date(this.current.getTime() + milliseconds)
  }
}

export type AuthAcceptanceHarness = {
  app: INestApplication
  baseUrl: string | undefined
  clock: ControllableClock
  mailMessages: CapturedMailMessage[]
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
}

export async function createAuthAcceptanceHarness(options: { listen?: boolean } = {}) {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureAuthTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  if (options.listen) {
    await app.listen(0, '127.0.0.1')
  }

  const mailMessages = moduleRef.get<CapturedMailMessage[]>(MAIL_CAPTURED_MESSAGES)
  const em = moduleRef.get(EntityManager)
  const redis = moduleRef.get<Redis>(REDIS_CLIENT)

  return {
    app,
    baseUrl: options.listen ? await getAppBaseUrl(app) : undefined,
    clock: new ControllableClock(),
    mailMessages,
    moduleRef,
    resetState: async () => {
      mailMessages.length = 0
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
  } satisfies AuthAcceptanceHarness
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

export type SetCookieHeaders = string | string[] | undefined

export function getCookieValue(setCookieHeaders: SetCookieHeaders, cookieName: string) {
  const cookie = normalizeSetCookieHeaders(setCookieHeaders).find((header) =>
    header.startsWith(`${cookieName}=`),
  )
  return cookie?.split(';')[0].slice(cookieName.length + 1)
}

export function getCookieHeader(setCookieHeaders: SetCookieHeaders, cookieName: string) {
  return normalizeSetCookieHeaders(setCookieHeaders)
    .find((header) => header.startsWith(`${cookieName}=`))
    ?.split(';')[0]
}

function normalizeSetCookieHeaders(setCookieHeaders: SetCookieHeaders) {
  if (setCookieHeaders === undefined) {
    return []
  }

  return Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
}

export function extractFirstUrl(message: CapturedMailMessage) {
  const match = message.text.match(/https?:\/\/\S+/)

  if (!match) {
    throw new Error('Captured mail did not contain a URL')
  }

  return new URL(match[0])
}

function configureAuthTestEnv(
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

async function getAppBaseUrl(app: INestApplication) {
  const url = await app.getUrl().catch(() => undefined)

  if (url === undefined || url.endsWith('[::1]:0')) {
    return undefined
  }

  return url.replace('http://[::1]', 'http://127.0.0.1')
}
