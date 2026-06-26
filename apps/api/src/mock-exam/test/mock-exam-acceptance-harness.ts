import 'reflect-metadata'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { REDIS_CLIENT } from '../../redis/redis.module'
import { MockExamAutoSubmitCron } from '../mock-exam-auto-submit.cron'
import { MockExamGenerationProcessor } from '../mock-exam-generation.processor'
import {
  CORRECT_ANSWER,
  configureTestEnv,
  createMockProviderValue,
  truncateTables,
} from './mock-exam-test-utils'

export { CORRECT_ANSWER as MOCK_EXAM_CORRECT_ANSWER }

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

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
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
