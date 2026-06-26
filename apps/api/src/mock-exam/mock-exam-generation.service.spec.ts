import 'reflect-metadata'
import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  MockExam,
  User,
  UserCertification,
  startPostgresContainer,
  startRedisContainer,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { REDIS_CLIENT } from '../redis/redis.module'
import { MockExamGenerationService } from './mock-exam-generation.service'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

/**
 * The correct answer must appear verbatim inside at least one supporting span
 * (validateExtractiveContract answerBacked check). 'key concepts' appears in
 * SUPPORTING_SPAN, which is also a verbatim substring of every seeded chunk's
 * text, satisfying the span-in-chunk check as well.
 */
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

const FAIL_VERDICT = JSON.stringify({
  pass: false,
  score: 0.1,
  distractorFindings: [],
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

describe('MockExamGenerationService (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let app: INestApplication
  let service: MockExamGenerationService
  let em: EntityManager
  let redis: Redis

  /**
   * Stateful flag: when true the next verifier call returns a failing verdict
   * so the GroundedGenerationService retry loop is exercised. Reset in beforeEach.
   */
  let failNextVerifier = false

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
          if (failNextVerifier) {
            failNextVerifier = false
            text = FAIL_VERDICT
          } else {
            text = PASS_VERDICT
          }
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

    service = moduleRef.get(MockExamGenerationService)
    em = moduleRef.get(EntityManager)
    redis = moduleRef.get<Redis>(REDIS_CLIENT)
  }, 180_000)

  afterAll(async () => {
    await app?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    failNextVerifier = false
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

  async function seedUser(): Promise<string> {
    const fork = em.fork()
    const user = fork.create(User, {
      email: `gen-test-${Math.random()}@example.com`,
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    fork.persist(user)
    await fork.flush()
    return user.id
  }

  async function seedAttempt(
    userId: string,
    cert: Certification,
  ): Promise<{ attemptId: string; enrollmentId: string }> {
    const fork = em.fork()

    const enrollment = fork.create(UserCertification, {
      user: fork.getReference(User, userId),
      certification: fork.getReference(Certification, cert.id),
    })
    fork.persist(enrollment)
    await fork.flush()

    const attempt = fork.create(MockExam, {
      user: fork.getReference(User, userId),
      userCertification: fork.getReference(UserCertification, enrollment.id),
      questions: [],
      domainBreakdown: {},
    })
    fork.persist(attempt)
    await fork.flush()

    return { attemptId: attempt.id, enrollmentId: enrollment.id }
  }

  describe('generateQuestionsForAttempt', () => {
    it('allocates slots proportional to domain weights (Security 50%, Networking 50% → 2 each)', async () => {
      const cert = await seedCert('GEN-ALLOC-01')
      for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
        await seedChunk(cert.id, domain)
      }
      const userId = await seedUser()
      const { attemptId } = await seedAttempt(userId, cert)

      await service.generateQuestionsForAttempt(attemptId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(4)
      expect(attempt.questions.filter((q) => q.domain === 'Security')).toHaveLength(2)
      expect(attempt.questions.filter((q) => q.domain === 'Networking')).toHaveLength(2)
    })

    it('persists each question with sourceChunkIds, supportingSpans, and a passing verifier verdict', async () => {
      const cert = await seedCert('GEN-PROV-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const userId = await seedUser()
      const { attemptId } = await seedAttempt(userId, cert)

      await service.generateQuestionsForAttempt(attemptId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(4)
      for (const q of attempt.questions) {
        expect(q.provenance.sourceChunkIds).toBeDefined()
        expect(q.provenance.sourceChunkIds.length).toBeGreaterThan(0)
        expect(q.provenance.supportingSpans).toBeDefined()
        expect(q.provenance.supportingSpans.length).toBeGreaterThan(0)
        expect(q.provenance.verdict).toBeDefined()
        expect(q.provenance.verdict.pass).toBe(true)
        expect(q.correctAnswer).toBeDefined()
        expect(q.explanation).toBeDefined()
        expect(q.selectedAnswer).toBeNull()
      }
    })

    it('Questions appear before the clock starts: deadline and startedAt remain null after generation', async () => {
      const cert = await seedCert('GEN-NODL-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const userId = await seedUser()
      const { attemptId } = await seedAttempt(userId, cert)

      await service.generateQuestionsForAttempt(attemptId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.startedAt).toBeNull()
      expect(attempt.deadline).toBeNull()
      expect(attempt.questions).toHaveLength(4)
      expect(attempt.status).toBe('in_progress')
    })

    it('substitutes a replacement when verifier fails once: final set is fully verified at correct count', async () => {
      const cert = await seedCert('GEN-SUBST-01')
      for (const domain of ['Security', 'Networking']) {
        await seedChunk(cert.id, domain)
        await seedChunk(cert.id, domain)
      }
      const userId = await seedUser()
      const { attemptId } = await seedAttempt(userId, cert)

      // Cause the first verifier call to fail — GroundedGenerationService's retry
      // loop will regenerate and the second attempt will pass the verifier.
      failNextVerifier = true

      await service.generateQuestionsForAttempt(attemptId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(4)
      for (const q of attempt.questions) {
        expect(q.provenance.verdict.pass).toBe(true)
      }
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
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}
