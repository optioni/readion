import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { REDIS_CLIENT } from '../../redis/redis.module'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

export type WeakAreasAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  seedCertification: (code: string, state: 'live' | 'draft') => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  seedQuizResponse: (
    enrollmentId: string,
    chunkId: string,
    correct: boolean,
    confidence: number,
  ) => Promise<void>
  enroll: (token: string, certificationId: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  seedEnrollment: (userId: string, certId: string) => Promise<string>
}

export async function createWeakAreasAcceptanceHarness(): Promise<WeakAreasAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    host: postgresContainer.getHost(),
    port: postgresContainer.getMappedPort(5432),
    dbName: 'readion_test',
  })
  await orm.migrator.up()
  await orm.close()

  const mockEmbeddingModel = new MockEmbeddingModelV3({
    doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
      embeddings: values.map(() => new Array(1536).fill(0.1)),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  })

  const mockLangModel = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text', text: '{}' }],
      finishReason: FINISH_REASON_STOP,
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    }),
  })

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ProviderAdapter)
    .useValue({
      getChatModel: vi.fn().mockReturnValue(mockLangModel),
      getEmbeddingModel: vi.fn().mockReturnValue(mockEmbeddingModel),
    })
    .compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)

  return {
    app,
    moduleRef,
    resetState: async () => {
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    registerAndLogin: async (email: string, password: string) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
      return res.body.data.accessToken as string
    },
    seedCertification: async (code: string, state: 'live' | 'draft') => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains: [{ name: 'Cloud Concepts', weight: 100 }],
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: 'verified',
        state,
      })
      fork.persist(cert)
      await fork.flush()
      return cert
    },
    seedChunk: async (certId: string, domain: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()

      const sourceResult = await conn.execute<{ id: string }[]>(
        `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'web', ?, 60, now(), now())
         RETURNING id`,
        [certId, `https://test.example.com/${Math.random()}`],
      )
      const sourceId = sourceResult[0]!.id

      const vectorLiteral = `[${new Array(1536).fill(0.1).join(',')}]`
      const chunkResult = await conn.execute<{ id: string }[]>(
        `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', 'active', now(), now())
         RETURNING id`,
        [
          sourceId,
          certId,
          `Content for domain ${domain}`,
          `hash-${Math.random()}`,
          vectorLiteral,
          JSON.stringify([{ domain, confidence: 1.0 }]),
          domain,
        ],
      )
      return chunkResult[0]!.id
    },
    seedQuizResponse: async (
      enrollmentId: string,
      chunkId: string,
      correct: boolean,
      confidence: number,
    ) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const snapshot = JSON.stringify({
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        provenance: {
          sourceChunkIds: [chunkId],
          supportingSpans: ['test span'],
          verdict: { pass: true, score: 0.9, distractorFindings: [] },
          score: 0.9,
        },
      })
      await conn.execute(
        `INSERT INTO quiz_responses (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'A', ?, ?, 5000, ?::jsonb, 'multiple_choice', now(), now())`,
        [enrollmentId, correct, confidence, snapshot],
      )
    },
    enroll: async (token: string, certificationId: string) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId })
      return res.body.data.id as string
    },
    getUserIdFromToken: async (token: string) => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
      return res.body.data.id as string
    },
    seedEnrollment: async (userId: string, certId: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const result = await conn.execute<{ id: string }[]>(
        `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())
         RETURNING id`,
        [userId, certId],
      )
      return result[0]!.id
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
  if (tables.length === 0) return
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
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
}
