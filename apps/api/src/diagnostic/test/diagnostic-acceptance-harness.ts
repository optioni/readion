import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  QuizResponse,
  ReviewItem,
  startPostgresContainer,
  startRedisContainer,
  WeakArea,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { MockExamAutoSubmitCron } from '../../mock-exam/mock-exam-auto-submit.cron'
import { MockExamGenerationProcessor } from '../../mock-exam/mock-exam-generation.processor'
import {
  configureTestEnv,
  createMockProviderValue,
  truncateTables,
} from '../../mock-exam/test/mock-exam-test-utils'
import { REDIS_CLIENT } from '../../redis/redis.module'

export { CORRECT_ANSWER as DIAGNOSTIC_CORRECT_ANSWER } from '../../mock-exam/test/mock-exam-test-utils'

export const DIAGNOSTIC_QUESTION_COUNT = 12

export type DiagnosticAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  em: EntityManager
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  seedCertification: (code: string) => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  enroll: (token: string, certificationId: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  runGenerationJob: (mockExamId: string) => Promise<void>
  runAutoSubmitCron: (now?: Date) => Promise<void>
  countQuizResponses: (enrollmentId: string) => Promise<number>
  countReviewItems: (enrollmentId: string) => Promise<number>
  countWeakAreas: (enrollmentId: string) => Promise<number>
  getRequest: () => ReturnType<typeof supertest>
}

export async function createDiagnosticAcceptanceHarness(): Promise<DiagnosticAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])
  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ProviderAdapter)
    .useValue(createMockProviderValue())
    .compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)

  return {
    app,
    moduleRef,
    em,

    resetState: async () => {
      await redis.flushdb()
      await truncateTables(em)
    },

    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },

    registerAndLogin: async (email, password) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
      return res.body.data.accessToken as string
    },

    seedCertification: async (code) => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains: [
          { name: 'Security', weight: 50 },
          { name: 'Networking', weight: 50 },
        ],
        questionCount: DIAGNOSTIC_QUESTION_COUNT,
        passingScore: 700,
        timeLimitMinutes: 10,
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
      const sourceResult = await conn.execute(
        `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'web', ?, 60, now(), now()) RETURNING id`,
        [certId, `https://test.example.com/${Math.random()}`],
      )
      const sourceId = sourceResult[0].id
      const vectorLiteral = `[${new Array(1536).fill(0.1).join(',')}]`
      const chunkResult = await conn.execute(
        `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', 'active', now(), now()) RETURNING id`,
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
      return chunkResult[0].id
    },

    enroll: async (token, certificationId) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId })
      return res.body.data.id as string
    },

    getUserIdFromToken: async (token) => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
      return res.body.data.id as string
    },

    runGenerationJob: async (mockExamId) => {
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

    runAutoSubmitCron: async (now) => {
      const cron = moduleRef.get(MockExamAutoSubmitCron)
      await cron.sweep(now)
    },

    countQuizResponses: async (enrollmentId) => {
      const fork = em.fork()
      const count = await fork.count(QuizResponse, { userCertification: enrollmentId })
      return count
    },

    countReviewItems: async (enrollmentId) => {
      const fork = em.fork()
      const count = await fork.count(ReviewItem, { userCertification: enrollmentId })
      return count
    },

    countWeakAreas: async (enrollmentId) => {
      const fork = em.fork()
      const count = await fork.count(WeakArea, { userCertification: enrollmentId })
      return count
    },

    getRequest: () => supertest(app.getHttpServer()),
  }
}
