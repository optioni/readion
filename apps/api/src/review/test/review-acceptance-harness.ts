import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { extractSourceChunkId } from '../../mock-exam/test/mock-exam-test-utils'
import { REDIS_CLIENT } from '../../redis/redis.module'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

export const CORRECT_ANSWER = 'key concepts'

const MOCK_READING_BLOCK = JSON.stringify({
  markdown: '## Overview\n\nThis is a test reading block.',
  tldr: ['Key point 1', 'Key point 2', 'Key point 3'],
  supportingSpans: ['This is a test reading block'],
})

const MOCK_VERIFIER_VERDICT = JSON.stringify({
  pass: true,
  score: 1.0,
  distractorFindings: [
    { option: 'Option B', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option C', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option D', isCorrect: false, reason: 'Not supported by source material' },
  ],
})

function buildMockQuizItem(sourceChunkId: string): string {
  return JSON.stringify({
    question: 'What is the main purpose of this service?',
    options: [CORRECT_ANSWER, 'Option B', 'Option C', 'Option D'],
    correctAnswer: CORRECT_ANSWER,
    supportingSpans: ['key concepts and examples'],
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

export type ReviewHarness = {
  app: INestApplication
  moduleRef: TestingModule
  em: EntityManager
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  seedCertification: (code: string) => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  seedEnrollment: (userId: string, certId: string) => Promise<string>
  seedReviewItem: (
    enrollmentId: string,
    anchorChunkId: string,
    opts: { box?: number; state?: string; dueInDays?: number },
  ) => Promise<string>
  supersedeChunk: (chunkId: string, supersededById: string | null) => Promise<void>
  answerQuiz: (
    token: string,
    enrollmentId: string,
    domain: string,
    opts: { answer: string; confidence: number },
  ) => Promise<void>
  listReviewItems: (
    enrollmentId: string,
  ) => Promise<
    { id: string; anchor_chunk_id: string; box: number; state: string; due_at: string }[]
  >
  getRequest: () => ReturnType<typeof supertest>
}

export async function createReviewHarness(): Promise<ReviewHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

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
      } else if (allText.includes('quiz question')) {
        const sourceChunkId =
          extractSourceChunkId(allText) ?? '00000000-0000-0000-0000-000000000000'
        text = buildMockQuizItem(sourceChunkId)
      } else {
        text = MOCK_READING_BLOCK
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

  const request = () => supertest(app.getHttpServer())

  return {
    app,
    moduleRef,
    em,
    resetState: async () => {
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    registerAndLogin: async (email, password) => {
      const res = await request().post('/api/v1/auth/register').send({ email, password })
      return res.body.data.accessToken as string
    },
    getUserIdFromToken: async (token) => {
      const res = await request().get('/api/v1/users/me').set('Authorization', `Bearer ${token}`)
      return res.body.data.id as string
    },
    seedCertification: async (code) => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains: [
          { name: 'Security', weight: 60 },
          { name: 'Networking', weight: 40 },
        ],
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: 'verified',
        state: 'live',
      })
      fork.persist(cert)
      await fork.flush()
      return cert
    },
    seedChunk: async (certId, domain) => {
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
          `Study content for ${domain}: key concepts and examples.`,
          `hash-${Math.random()}`,
          vectorLiteral,
          JSON.stringify([{ domain, confidence: 1.0 }]),
          domain,
        ],
      )
      return chunkResult[0]!.id
    },
    seedEnrollment: async (userId, certId) => {
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
    seedReviewItem: async (enrollmentId, anchorChunkId, opts) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const box = opts.box ?? 1
      const state = opts.state ?? 'active'
      const dueInDays = opts.dueInDays ?? -1
      const result = await conn.execute<{ id: string }[]>(
        `INSERT INTO review_items (id, user_certification_id, anchor_chunk_id, box, state, due_at, last_reviewed_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, now() + (? || ' days')::interval, NULL, now(), now())
         RETURNING id`,
        [enrollmentId, anchorChunkId, box, state, String(dueInDays)],
      )
      return result[0]!.id
    },
    supersedeChunk: async (chunkId, supersededById) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute(
        `UPDATE content_chunks SET state = 'superseded', superseded_by_id = ?, superseded_at = now(), updated_at = now() WHERE id = ?`,
        [supersededById, chunkId],
      )
    },
    answerQuiz: async (token, enrollmentId, domain, opts) => {
      const gen = await request()
        .post('/api/v1/quiz/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ userCertificationId: enrollmentId, domain, difficulty: 'intermediate' })
      const questionId = gen.body.data.id as string
      await request()
        .post(`/api/v1/quiz/${questionId}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userCertificationId: enrollmentId,
          answer: opts.answer,
          confidence: opts.confidence,
          timeTakenMs: 1000,
        })
    },
    listReviewItems: async (enrollmentId) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      return conn.execute(
        `SELECT id, anchor_chunk_id, box, state, due_at FROM review_items
         WHERE user_certification_id = ? ORDER BY created_at ASC`,
        [enrollmentId],
      )
    },
    getRequest: request,
  }
}

async function truncateDomainTables(em: EntityManager) {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables: { tablename: string }[] = await conn.execute(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != 'mikro_orm_migrations'
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
