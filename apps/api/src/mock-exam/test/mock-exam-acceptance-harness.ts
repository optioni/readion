import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type { Job } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { REDIS_CLIENT } from '../../redis/redis.module'
import { MockExamAutoSubmitCron } from '../mock-exam-auto-submit.cron'
import { MockExamGenerationProcessor } from '../mock-exam-generation.processor'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

/**
 * 'key concepts' is a verbatim substring of every seeded chunk's text
 * ("Study content for <domain>: key concepts, best practices, and real-world
 * examples."), and it also appears inside SUPPORTING_SPAN. Both checks in
 * validateExtractiveContract (span-in-chunk and answerBacked) therefore pass,
 * allowing the real GroundedGenerationService pipeline to succeed in tests.
 */
export const MOCK_EXAM_CORRECT_ANSWER = 'key concepts'

const MOCK_VERIFIER_VERDICT = JSON.stringify({
  pass: true,
  score: 1.0,
  distractorFindings: [
    { option: 'Option B', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option C', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option D', isCorrect: false, reason: 'Not supported by source material' },
  ],
})

function buildMockQuizQuestion(sourceChunkId: string): string {
  return JSON.stringify({
    question: 'What is the primary concept in this domain?',
    options: [MOCK_EXAM_CORRECT_ANSWER, 'Option B', 'Option C', 'Option D'],
    correctAnswer: MOCK_EXAM_CORRECT_ANSWER,
    supportingSpans: ['key concepts, best practices, and real-world examples.'],
    sourceChunkIds: [sourceChunkId],
  })
}

function extractMessageText(prompt: Array<{ role: string; content: unknown }>): string {
  return prompt
    .flatMap((msg) => {
      if (Array.isArray(msg.content)) {
        return (msg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
      }
      return [typeof msg.content === 'string' ? msg.content : '']
    })
    .join('\n')
}

export type MockExamAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  seedCertification: (code: string) => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  enroll: (token: string, certificationId: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  seedEnrollment: (userId: string, certId: string) => Promise<string>
  runGenerationJob: (mockExamId: string) => Promise<void>
  runAutoSubmitCron: (now?: Date) => Promise<void>
  getRequest: () => ReturnType<typeof supertest>
}

export async function createMockExamAcceptanceHarness(): Promise<MockExamAcceptanceHarness> {
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
    doGenerate: async ({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) => {
      const allText = extractMessageText(prompt)

      let text: string
      if (allText.includes('independent answer verifier') || allText.includes('Verify:')) {
        text = MOCK_VERIFIER_VERDICT
      } else {
        const chunkIdMatch = allText.match(
          /\[(?:Source: )?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/,
        )
        const sourceChunkId = chunkIdMatch?.[1] ?? '00000000-0000-0000-0000-000000000000'
        text = buildMockQuizQuestion(sourceChunkId)
      }

      return {
        content: [{ type: 'text', text }],
        finishReason: FINISH_REASON_STOP,
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }
    },
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
    seedCertification: async (code: string) => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains: [
          { name: 'Security', weight: 50 },
          { name: 'Networking', weight: 50 },
        ],
        questionCount: 4,
        passingScore: 700,
        timeLimitMinutes: 10,
        provenance: 'verified',
        state: 'live',
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
          `Study content for ${domain}: key concepts, best practices, and real-world examples.`,
          `hash-${Math.random()}`,
          vectorLiteral,
          JSON.stringify([{ domain, confidence: 1.0 }]),
          domain,
        ],
      )
      return chunkResult[0]!.id
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
    runGenerationJob: async (mockExamId: string): Promise<void> => {
      const processor = moduleRef.get(MockExamGenerationProcessor)
      const job = {
        id: 'harness-1',
        queueName: MOCK_EXAM_GENERATION_QUEUE,
        name: 'mock-exam-generation',
        data: { attemptId: mockExamId },
        opts: {},
        timestamp: Date.now(),
        attemptsMade: 0,
        stacktrace: [],
        returnvalue: null,
      } as Partial<Job<MockExamGenerationJobPayload>> as Job<MockExamGenerationJobPayload>
      await processor.process(job)
    },
    runAutoSubmitCron: async (now?: Date): Promise<void> => {
      const cron = moduleRef.get(MockExamAutoSubmitCron)
      await cron.sweep(now)
    },
    getRequest: () => supertest(app.getHttpServer()),
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
  const names = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
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
