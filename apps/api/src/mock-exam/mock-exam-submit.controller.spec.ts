import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  QuizResponse,
  startPostgresContainer,
  startRedisContainer,
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
const WRONG_ANSWER = 'Option B'
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
    id: 'test-submit-1',
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

/**
 * Integration tests for POST /api/v1/mock-exams/:id/submit
 *
 * Covers:
 * (a) Submitting scores the attempt and persists the result
 * (b) Mock answers are recorded as enrollment QuizResponses
 * (c) Domain breakdown feeds weak areas via recompute
 * (d) Submitting an already-terminal attempt is rejected (409)
 */
describe('POST /api/v1/mock-exams/:id/submit (integration)', () => {
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
        } else if (allText.includes('explanation')) {
          text = JSON.stringify({
            question: 'The correct answer is key concepts because it is the primary concept.',
            options: ['explanation'],
            correctAnswer: 'explanation',
            supportingSpans: [SUPPORTING_SPAN],
            sourceChunkIds: ['00000000-0000-0000-0000-000000000000'],
          })
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

  async function seedCert(code: string): Promise<string> {
    const fork = em.fork()
    const conn = fork.getConnection()
    const result = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications
         (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes,
          state, provenance, created_at, updated_at)
       VALUES
         (gen_random_uuid(), ?, 'AWS', ?, ?::jsonb, 4, 700, 10, 'live', '"verified"', now(), now())
       RETURNING id`,
      [
        `Cert ${code}`,
        code,
        JSON.stringify([
          { name: 'Security', weight: 50 },
          { name: 'Networking', weight: 50 },
        ]),
      ],
    )
    return result[0]!.id
  }

  async function seedChunks(certId: string): Promise<void> {
    for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
      await seedChunk(certId, domain)
    }
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

  async function saveAnswer(
    token: string,
    mockId: string,
    questionIndex: number,
    answer: string,
  ): Promise<void> {
    await supertest(app.getHttpServer())
      .put(`/api/v1/mock-exams/${mockId}/answers/${questionIndex}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer })
  }

  /**
   * (a) Submitting scores the attempt and persists the result.
   *
   * Cert: 4 questions (2 Security, 2 Networking), passingScore 700 (0.7 on 0–1 scale).
   * Setup: answer question 0 correctly; questions 1–3 unanswered.
   * Expected: score = 1/4 = 0.25, passed = false, domainBreakdown reflects per-domain accuracy.
   */
  describe('(a) Submitting scores the attempt and persists the result', () => {
    it('returns 200 with submitted status, correct score, pass/fail, and domain breakdown', async () => {
      const certId = await seedCert('SUBMIT-SCORE-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-score-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Answer question 0 correctly; leave questions 1–3 unanswered
      await saveAnswer(token, mockId, 0, CORRECT_ANSWER)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      const data = res.body.data as {
        id: string
        status: string
        score: number
        passed: boolean
        domainBreakdown: Record<string, { correct: number; total: number; accuracy: number }>
      }

      expect(data.id).toBe(mockId)
      expect(data.status).toBe('submitted')
      // 1 correct out of 4 total
      expect(data.score).toBeCloseTo(0.25, 5)
      // 0.25 < 0.7 (700/1000)
      expect(data.passed).toBe(false)

      // Domain breakdown: Security 1/2, Networking 0/2
      expect(data.domainBreakdown.Security).toBeDefined()
      expect(data.domainBreakdown.Security.correct).toBe(1)
      expect(data.domainBreakdown.Security.total).toBe(2)
      expect(data.domainBreakdown.Security.accuracy).toBeCloseTo(0.5, 5)

      expect(data.domainBreakdown.Networking).toBeDefined()
      expect(data.domainBreakdown.Networking.correct).toBe(0)
      expect(data.domainBreakdown.Networking.total).toBe(2)
      expect(data.domainBreakdown.Networking.accuracy).toBeCloseTo(0, 5)
    })

    it('treats unanswered questions as incorrect in both overall score and domain breakdown', async () => {
      const certId = await seedCert('SUBMIT-UNANSWERED-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-unanswered-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Leave ALL questions unanswered
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      const data = res.body.data as {
        score: number
        passed: boolean
        domainBreakdown: Record<string, { correct: number; total: number; accuracy: number }>
      }

      expect(data.score).toBeCloseTo(0, 5)
      expect(data.passed).toBe(false)
      expect(data.domainBreakdown.Security.correct).toBe(0)
      expect(data.domainBreakdown.Networking.correct).toBe(0)
    })
  })

  /**
   * (b) Mock answers are recorded as enrollment QuizResponses.
   *
   * After submit, one QuizResponse per question must exist under the enrollment:
   * - each embeds the question's provenance snapshot
   * - answered question: correct=true, answer=CORRECT_ANSWER, confidence=3
   * - unanswered questions: correct=false, answer='', confidence=3
   */
  describe('(b) Mock answers are recorded as enrollment QuizResponses', () => {
    it('emits one QuizResponse per question with correct snapshot, correctness, and neutral confidence', async () => {
      const certId = await seedCert('SUBMIT-QR-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-qr-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Answer question 0 correctly; 1 incorrectly; 2 and 3 unanswered
      await saveAnswer(token, mockId, 0, CORRECT_ANSWER)
      await saveAnswer(token, mockId, 1, WRONG_ANSWER)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)

      const fork = em.fork()
      const responses = await fork.find(QuizResponse, { userCertification: enrollmentId })

      expect(responses).toHaveLength(4)

      // All responses must have confidence = 3 (neutral) and a valid snapshot
      for (const r of responses) {
        expect(r.confidence).toBe(3)
        expect(r.questionSnapshot).toBeDefined()
        expect(r.questionSnapshot.provenance.sourceChunkIds.length).toBeGreaterThan(0)
        expect(r.questionSnapshot.correctAnswer).toBe(CORRECT_ANSWER)
      }

      const correctResponses = responses.filter((r) => r.correct)
      const incorrectResponses = responses.filter((r) => !r.correct)

      // Question 0 answered correctly
      expect(correctResponses).toHaveLength(1)
      expect(correctResponses[0]!.answer).toBe(CORRECT_ANSWER)

      // Questions 1 (wrong answer), 2 and 3 (unanswered) → all incorrect
      expect(incorrectResponses).toHaveLength(3)

      // The incorrectly answered one has the wrong answer
      const wronglyAnswered = incorrectResponses.find((r) => r.answer === WRONG_ANSWER)
      expect(wronglyAnswered).toBeDefined()

      // Unanswered responses have empty string as answer
      const unansweredResponses = incorrectResponses.filter((r) => r.answer === '')
      expect(unansweredResponses).toHaveLength(2)
    })
  })

  /**
   * (c) Domain breakdown feeds weak areas via recompute.
   *
   * After submit, WeakAreasService.recompute is called and WeakArea rows appear
   * for both Security and Networking, reflecting per-domain accuracy from the
   * mock's QuizResponses (attributed via the source chunk's primaryDomain).
   */
  describe('(c) Domain breakdown feeds weak areas via recompute', () => {
    it('creates WeakArea rows for both domains with accuracy reflecting mock results', async () => {
      const certId = await seedCert('SUBMIT-WA-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-wa-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Answer question 0 correctly (Security domain); leave rest unanswered
      await saveAnswer(token, mockId, 0, CORRECT_ANSWER)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)

      // Read weak_areas table directly
      const fork = em.fork()
      const conn = fork.getConnection()
      const rows = await conn.execute<
        { domain: string; accuracy: number; response_count: number }[]
      >(
        `SELECT domain, accuracy, response_count
         FROM weak_areas
         WHERE user_certification_id = ?
         ORDER BY domain`,
        [enrollmentId],
      )

      // Both domains should have weak area rows
      expect(rows.length).toBeGreaterThanOrEqual(2)

      const securityRow = rows.find((r) => r.domain === 'Security')
      const networkingRow = rows.find((r) => r.domain === 'Networking')

      expect(securityRow).toBeDefined()
      expect(securityRow!.response_count).toBe(2)
      // 1 correct out of 2 Security questions → accuracy 0.5
      expect(securityRow!.accuracy).toBeCloseTo(0.5, 5)

      expect(networkingRow).toBeDefined()
      expect(networkingRow!.response_count).toBe(2)
      // 0 correct out of 2 Networking questions → accuracy 0
      expect(networkingRow!.accuracy).toBeCloseTo(0, 5)
    })
  })

  /**
   * (d) Submitting an already-terminal attempt is rejected.
   *
   * A second submit on an already-submitted attempt returns 409,
   * and the stored result remains unchanged.
   */
  describe('(d) Submitting an already-terminal attempt is rejected', () => {
    it('returns 409 on a second submit and leaves the stored result unchanged', async () => {
      const certId = await seedCert('SUBMIT-TERMINAL-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-terminal-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // First submit → 200
      const first = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(first.status).toBe(200)

      const firstScore = (first.body.data as { score: number }).score

      // Second submit → 409
      const second = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(second.status).toBe(409)

      // Score is still the same (unchanged)
      const getRes = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(getRes.status).toBe(200)
      expect((getRes.body.data as { score: number }).score).toBeCloseTo(firstScore, 5)
    })

    it('returns 409 for an attempt with status expired', async () => {
      const certId = await seedCert('SUBMIT-EXPIRED-01')
      await seedChunks(certId)

      const token = await registerAndLogin('submit-expired-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Mark as expired directly in DB
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute('UPDATE mock_exams SET status = ? WHERE id = ?', ['expired', mockId])

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(409)
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
