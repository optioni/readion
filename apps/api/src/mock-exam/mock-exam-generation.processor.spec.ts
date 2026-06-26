import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  MockExam,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type { Job } from 'bullmq'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { REDIS_CLIENT } from '../redis/redis.module'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

const CORRECT_ANSWER = 'key concepts'
const SUPPORTING_SPAN = 'key concepts, best practices, and real-world examples.'

const PASS_VERDICT = JSON.stringify({
  pass: true,
  score: 1.0,
  distractorFindings: [
    { option: 'Option B', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option C', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option D', isCorrect: false, reason: 'Not supported by source material' },
  ],
})

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

function buildMockQuestion(sourceChunkId: string): string {
  return JSON.stringify({
    question: 'What is the primary concept in this domain?',
    options: [CORRECT_ANSWER, 'Option B', 'Option C', 'Option D'],
    correctAnswer: CORRECT_ANSWER,
    supportingSpans: [SUPPORTING_SPAN],
    sourceChunkIds: [sourceChunkId],
  })
}

function fakeJob(data: MockExamGenerationJobPayload): Job<MockExamGenerationJobPayload> {
  return {
    id: 'test-1',
    queueName: MOCK_EXAM_GENERATION_QUEUE,
    name: 'mock-exam-generation',
    data,
    opts: {},
    timestamp: Date.now(),
    attemptsMade: 0,
    stacktrace: [],
    returnvalue: null,
  } as Partial<Job<MockExamGenerationJobPayload>> as Job<MockExamGenerationJobPayload>
}

describe('MockExamGenerationProcessor (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let app: INestApplication
  let processor: MockExamGenerationProcessor
  let em: EntityManager
  let redis: Redis

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])

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

    const orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: dbHost,
      port: dbPort,
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
          text = PASS_VERDICT
        } else {
          const chunkIdMatch = allText.match(
            /\[(?:Source: )?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/,
          )
          const sourceChunkId = chunkIdMatch?.[1] ?? '00000000-0000-0000-0000-000000000000'
          text = buildMockQuestion(sourceChunkId)
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

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProviderAdapter)
      .useValue({
        getChatModel: vi.fn().mockReturnValue(mockLangModel),
        getEmbeddingModel: vi.fn().mockReturnValue(mockEmbeddingModel),
      })
      .compile()

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()

    processor = moduleRef.get(MockExamGenerationProcessor)
    em = moduleRef.get(EntityManager)
    redis = moduleRef.get<Redis>(REDIS_CLIENT)
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await redis.flushdb()
    await truncateTables(em)
  })

  async function seedCert(code: string): Promise<Certification> {
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
  }

  async function seedChunk(certId: string, domain: string): Promise<void> {
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
    await conn.execute(
      `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', 'active', now(), now())`,
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
  }

  async function seedAttempt(
    cert: Certification,
  ): Promise<{ attemptId: string; enrollmentId: string }> {
    const fork = em.fork()

    const user = fork.create(User, {
      email: `proc-test-${Math.random()}@example.com`,
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    fork.persist(user)
    await fork.flush()

    const enrollment = fork.create(UserCertification, {
      user: fork.getReference(User, user.id),
      certification: fork.getReference(Certification, cert.id),
    })
    fork.persist(enrollment)
    await fork.flush()

    const attempt = fork.create(MockExam, {
      user: fork.getReference(User, user.id),
      userCertification: fork.getReference(UserCertification, enrollment.id),
      questions: [],
      domainBreakdown: {},
    })
    fork.persist(attempt)
    await fork.flush()

    return { attemptId: attempt.id, enrollmentId: enrollment.id }
  }

  describe('Deadline starts only when the full set is ready', () => {
    it('startedAt and deadline are null before the processor runs', async () => {
      const cert = await seedCert('PROC-PRE-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      const fork = em.fork()
      const before = await fork.findOneOrFail(MockExam, { id: attemptId })
      expect(before.startedAt).toBeNull()
      expect(before.deadline).toBeNull()
      expect(before.questions).toHaveLength(0)
    })

    it('processor fills the full question set then stamps startedAt and deadline', async () => {
      const cert = await seedCert('PROC-STAMP-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      await processor.process(fakeJob({ attemptId }))

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(cert.questionCount)
      expect(attempt.startedAt).not.toBeNull()
      expect(attempt.deadline).not.toBeNull()

      const timeLimitMs = cert.timeLimitMinutes * 60 * 1000
      const startedAtMs = attempt.startedAt!.getTime()
      const deadlineMs = attempt.deadline!.getTime()
      expect(deadlineMs - startedAtMs).toBe(timeLimitMs)
    })

    it('generation reports preparing (deadline null) while questions are not yet complete', async () => {
      const cert = await seedCert('PROC-PREP-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      const fork = em.fork()
      const before = await fork.findOneOrFail(MockExam, { id: attemptId })
      expect(before.deadline).toBeNull()

      await processor.process(fakeJob({ attemptId }))

      const after = await fork.findOneOrFail(MockExam, { id: attemptId }, { refresh: true })
      expect(after.deadline).not.toBeNull()
    })

    it('verifier pipeline is exercised: all persisted questions carry passing verdicts', async () => {
      const cert = await seedCert('PROC-VERIF-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      await processor.process(fakeJob({ attemptId }))

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(cert.questionCount)
      for (const q of attempt.questions) {
        expect(q.provenance.verdict.pass).toBe(true)
        expect(q.provenance.sourceChunkIds.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Idempotency: re-running does not duplicate', () => {
    it('re-invoking on a partially-generated attempt fills remaining slots without duplicates', async () => {
      const cert = await seedCert('PROC-IDEM-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      const fork = em.fork()
      const conn = fork.getConnection()

      const partialQuestions = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          question: 'Pre-existing question',
          options: ['key concepts', 'B', 'C', 'D'],
          correctAnswer: 'key concepts',
          explanation: '',
          selectedAnswer: null,
          domain: 'Security',
          provenance: {
            sourceChunkIds: ['00000000-0000-0000-0000-000000000099'],
            supportingSpans: ['key concepts'],
            verdict: { pass: true, score: 1.0, distractorFindings: [] },
            score: 1.0,
          },
        },
      ]
      await conn.execute(`UPDATE mock_exams SET questions = ?::jsonb WHERE id = ?`, [
        JSON.stringify(partialQuestions),
        attemptId,
      ])

      await processor.process(fakeJob({ attemptId }))

      const attempt = await em.fork().findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(cert.questionCount)

      const ids = attempt.questions.map((q) => q.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(cert.questionCount)
      expect(uniqueIds.has('11111111-1111-1111-1111-111111111111')).toBe(true)

      expect(attempt.startedAt).not.toBeNull()
      expect(attempt.deadline).not.toBeNull()
    })

    it('re-running a completed attempt is a no-op: deadline unchanged, no extra questions', async () => {
      const cert = await seedCert('PROC-NOOP-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const { attemptId } = await seedAttempt(cert)

      await processor.process(fakeJob({ attemptId }))

      const fork1 = em.fork()
      const first = await fork1.findOneOrFail(MockExam, { id: attemptId })
      const originalDeadline = first.deadline!.toISOString()
      const originalQuestionCount = first.questions.length

      await processor.process(fakeJob({ attemptId }))

      const fork2 = em.fork()
      const second = await fork2.findOneOrFail(MockExam, { id: attemptId })

      expect(second.deadline!.toISOString()).toBe(originalDeadline)
      expect(second.questions).toHaveLength(originalQuestionCount)
    })
  })
})

async function truncateTables(em: EntityManager): Promise<void> {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables = await conn.execute<{ tablename: string }[]>(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)
  if (tables.length === 0) return
  const names = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}
