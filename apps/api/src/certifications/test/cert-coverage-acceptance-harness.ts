import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { DomainTag } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { v4 } from 'uuid'
import { AppModule } from '../../app.module'
import { AccessTokenService } from '../../auth/access-token.service'
import { bootstrapApp } from '../../bootstrap'

export type CertCoverageAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  issueToken: (role: 'admin' | 'user') => Promise<string>
  seedDraftCertification: (options: {
    domains: string[]
    questionCount: number
  }) => Promise<Certification>
  seedContentSource: (options: { certificationId: string; enabled?: boolean }) => Promise<string>
  seedActiveChunk: (options: {
    sourceId: string
    certificationId: string
    domainTags: DomainTag[]
    hash?: string
  }) => Promise<void>
  seedSupersededChunk: (options: {
    sourceId: string
    certificationId: string
    domainTags: DomainTag[]
    hash?: string
  }) => Promise<void>
}

export async function createCertCoverageAcceptanceHarness(): Promise<CertCoverageAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const em = moduleRef.get(EntityManager)
  const accessTokenService = moduleRef.get(AccessTokenService)

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
    issueToken: (role) => accessTokenService.issue({ userId: v4(), role }),
    seedDraftCertification: async ({ domains, questionCount }) => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: 'Test Certification',
        provider: 'AWS',
        code: `TEST-${v4().slice(0, 8)}`,
        domains: domains.map((name) => ({ name, weight: Math.floor(100 / domains.length) })),
        questionCount,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: 'verified',
        state: 'draft',
      })
      fork.persist(cert)
      await fork.flush()
      return cert
    },
    seedContentSource: async ({ certificationId, enabled = true }) => {
      const id = v4()
      const conn = em.getConnection()
      await conn.execute(
        `INSERT INTO content_sources (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
         VALUES (?, ?, 'web', ?, ?, 1440, NOW(), NOW())`,
        [id, certificationId, `https://example.com/${id}`, enabled],
      )
      return id
    },
    seedActiveChunk: async ({ sourceId, certificationId, domainTags, hash }) => {
      const conn = em.getConnection()
      await conn.execute(
        `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, domain_tags, primary_domain, metadata, state, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'test text', ?, ?::jsonb, ?, '{}'::jsonb, 'active', NOW(), NOW())`,
        [
          sourceId,
          certificationId,
          hash ?? v4(),
          JSON.stringify(domainTags),
          domainTags[0]?.domain ?? 'Unknown',
        ],
      )
    },
    seedSupersededChunk: async ({ sourceId, certificationId, domainTags, hash }) => {
      const conn = em.getConnection()
      await conn.execute(
        `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, domain_tags, primary_domain, metadata, state, superseded_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'test text', ?, ?::jsonb, ?, '{}'::jsonb, 'superseded', NOW(), NOW(), NOW())`,
        [
          sourceId,
          certificationId,
          hash ?? v4(),
          JSON.stringify(domainTags),
          domainTags[0]?.domain ?? 'Unknown',
        ],
      )
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

function configureTestEnv(
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
  process.env.CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN = '20'
  process.env.CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE = '3'
}
