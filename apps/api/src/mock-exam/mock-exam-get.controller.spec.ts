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
import supertest from 'supertest'
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

function buildMockQuestion(sourceChunkId: string): string {
  return JSON.stringify({
    question: 'What is the primary concept in this domain?',
    options: [CORRECT_ANSWER, 'Option B', 'Option C', 'Option D'],
    correctAnswer: CORRECT_ANSWER,
    supportingSpans: [SUPPORTING_SPAN],
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

function fakeJob(data: MockExamGenerationJobPayload): Job<MockExamGenerationJobPayload> {
  return {
    id: 'test-get-1',
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

describe('GET /api/v1/mock-exams/:id (integration)', () => {
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

  async function registerAndLogin(email: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correcthorse' })
    return res.body.data.accessToken as string
  }

  async function enroll(token: string, certId: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/user-certifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ certificationId: certId })
    return res.body.data.id as string
  }

  async function createMockExam(token: string, enrollmentId: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
      .set('Authorization', `Bearer ${token}`)
    return res.body.data.id as string
  }

  async function runGeneration(mockId: string): Promise<void> {
    await processor.process(fakeJob({ attemptId: mockId }))
  }

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

  async function createAttemptInDb(enrollmentId: string): Promise<string> {
    const fork = em.fork()
    const conn = fork.getConnection()
    const rows = await conn.execute<{ user_id: string }[]>(
      'SELECT user_id FROM user_certifications WHERE id = ?',
      [enrollmentId],
    )
    const userId = rows[0]!.user_id
    const attempt = fork.create(MockExam, {
      user: fork.getReference(User, userId),
      userCertification: fork.getReference(UserCertification, enrollmentId),
      questions: [],
      domainBreakdown: {},
    })
    fork.persist(attempt)
    await fork.flush()
    return attempt.id
  }

  async function seedChunk(certId: string, domain: string): Promise<string> {
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
  }

  describe('(a) mid-generation: preparing state', () => {
    it('returns generation:preparing, null deadline, null remainingSeconds while generating', async () => {
      const cert = await seedCert('GET-PREP-01')
      await seedChunk(cert.id, 'Security')

      const token = await registerAndLogin('get-prep-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.generation).toBe('preparing')
      expect(res.body.data.deadline).toBeNull()
      expect(res.body.data.remainingSeconds).toBeNull()
      expect(res.body.data.questions).toHaveLength(0)
    })
  })

  describe('(b) resume: remainingSeconds and preserved answers', () => {
    it('returns remainingSeconds and saved answers after a simulated disconnect', async () => {
      const cert = await seedCert('GET-RESUME-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await seedChunk(cert.id, domain)
      }

      const token = await registerAndLogin('get-resume-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: mockId })
      attempt.questions[0]!.selectedAnswer = CORRECT_ANSWER
      await fork.flush()

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.generation).toBe('ready')
      expect(res.body.data.remainingSeconds).toBeGreaterThan(0)
      expect(res.body.data.questions).toHaveLength(cert.questionCount)
      expect(res.body.data.questions[0].userAnswer).toBe(CORRECT_ANSWER)
      expect(res.body.data.questions[1].userAnswer).toBeNull()
    })
  })

  describe('(c) review mode: correctAnswer + explanation + citations from provenance', () => {
    it('returns review fields for a submitted attempt resolved from the persisted provenance', async () => {
      const cert = await seedCert('GET-REVIEW-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await seedChunk(cert.id, domain)
      }

      const token = await registerAndLogin('get-review-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: mockId })
      attempt.status = 'submitted'
      attempt.questions[0]!.selectedAnswer = CORRECT_ANSWER
      await fork.flush()

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('submitted')

      const questions: Array<{
        correctAnswer: string
        userAnswer: string | null
        explanation: string
        citations: Array<{ chunkId: string; text: string }>
      }> = res.body.data.questions

      expect(questions.length).toBe(cert.questionCount)

      for (const q of questions) {
        expect(q.correctAnswer).toBe(CORRECT_ANSWER)
        expect(q.explanation).toBeDefined()
        expect(Array.isArray(q.citations)).toBe(true)
        expect(q.citations.length).toBeGreaterThan(0)
        expect(q.citations[0]!.chunkId).toBeTruthy()
        expect(q.citations[0]!.text).toBe(SUPPORTING_SPAN)
      }

      expect(questions[0]!.userAnswer).toBe(CORRECT_ANSWER)
      expect(questions[1]!.userAnswer).toBeNull()
    })
  })

  describe('(d) in-progress: no leakage of review fields', () => {
    it('omits correctAnswer, explanation, and citations while the attempt is in_progress', async () => {
      const cert = await seedCert('GET-NOLEAK-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await seedChunk(cert.id, domain)
      }

      const token = await registerAndLogin('get-noleak-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('in_progress')
      expect(res.body.data.questions).toHaveLength(cert.questionCount)

      for (const q of res.body.data.questions as Array<Record<string, unknown>>) {
        expect(q).not.toHaveProperty('correctAnswer')
        expect(q).not.toHaveProperty('explanation')
        expect(q).not.toHaveProperty('citations')
      }
    })
  })

  describe('(e) cross-user: 404', () => {
    it("returns 200 for the owner but 404 when fetching another user's attempt", async () => {
      const cert = await seedCert('GET-XUSER-01')

      const owner = await registerAndLogin('get-xuser-owner@example.com')
      const enrollmentId = await enroll(owner, cert.id)

      const mockId = await createAttemptInDb(enrollmentId)

      const ownerRes = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${owner}`)
      expect(ownerRes.status).toBe(200)

      const other = await registerAndLogin('get-xuser-other@example.com')
      const otherRes = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${other}`)
      expect(otherRes.status).toBe(404)
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
