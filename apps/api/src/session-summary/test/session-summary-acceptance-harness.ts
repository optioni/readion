import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { MockLanguageModelV3 } from 'ai/test'
import type { Job } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { MockExamGenerationProcessor } from '../../mock-exam/mock-exam-generation.processor'
import {
  buildMockQuestion,
  CORRECT_ANSWER,
  configureTestEnv,
  createMockEmbeddingModel,
  extractMessageText,
  extractSourceChunkId,
  FINISH_REASON_STOP,
  PASS_VERDICT,
  truncateTables,
} from '../../mock-exam/test/mock-exam-test-utils'
import { REDIS_CLIENT } from '../../redis/redis.module'

export { CORRECT_ANSWER as SESSION_SUMMARY_CORRECT_ANSWER }
export const SESSION_SUMMARY_WRONG_ANSWER = 'Option B'

const MOCK_READING_BLOCK = JSON.stringify({
  markdown: '## Overview\n\nThis is a test reading block.\n\n**Key Concept:** Important idea.',
  tldr: ['Key point 1', 'Key point 2', 'Key point 3'],
  supportingSpans: ['This is a test reading block'],
})

function createCombinedMockLangModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async ({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) => {
      const allText = extractMessageText(prompt)

      let text: string
      if (allText.includes('independent answer verifier') || allText.includes('Verify:')) {
        text = PASS_VERDICT
      } else if (allText.includes('quiz question')) {
        const sourceChunkId =
          extractSourceChunkId(allText) ?? '00000000-0000-0000-0000-000000000000'
        text = buildMockQuestion(sourceChunkId)
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
}

export type PriorResponseSeed = {
  chunkId: string
  correct: boolean
  confidence: number
}

export type SessionSummaryAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  seedCertification: (code: string) => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  seedPriorResponses: (enrollmentId: string, responses: PriorResponseSeed[]) => Promise<void>
  enroll: (token: string, certificationId: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  runGenerationJob: (mockExamId: string) => Promise<void>
  getRequest: () => ReturnType<typeof supertest>
}

export async function createSessionSummaryAcceptanceHarness(): Promise<SessionSummaryAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  // Provide defaults for session-summary config vars so the module (once added)
  // can validate them without requiring changes to this harness.
  process.env.SUMMARY_DRILL_MAX_QUESTIONS = '7'
  process.env.SUMMARY_UNSURE_CONFIDENCE_THRESHOLD = '2'

  await acquireIsolatedDatabase()

  const langModel = createCombinedMockLangModel()
  const embeddingModel = createMockEmbeddingModel()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ProviderAdapter)
    .useValue({
      getChatModel: vi.fn().mockReturnValue(langModel),
      getEmbeddingModel: vi.fn().mockReturnValue(embeddingModel),
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
      await truncateTables(em)
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
    seedPriorResponses: async (
      enrollmentId: string,
      responses: PriorResponseSeed[],
    ): Promise<void> => {
      const fork = em.fork()
      const conn = fork.getConnection()
      for (const r of responses) {
        const snapshot = {
          question: 'Prior seeded question',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: CORRECT_ANSWER,
          provenance: { sourceChunkIds: [r.chunkId], supportingSpans: [] },
        }
        const answer = r.correct ? CORRECT_ANSWER : SESSION_SUMMARY_WRONG_ANSWER
        await conn.execute(
          `INSERT INTO quiz_responses
            (id, user_certification_id, answer, correct, confidence, time_taken_ms,
             question_snapshot, format, created_at, updated_at)
           VALUES (gen_random_uuid(), ?, ?, ?, ?, 2000, ?::jsonb,
                   'multiple-choice', now() - interval '2 hours', now() - interval '2 hours')`,
          [enrollmentId, answer, r.correct, r.confidence, JSON.stringify(snapshot)],
        )
      }
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
    getRequest: () => supertest(app.getHttpServer()),
  }
}
