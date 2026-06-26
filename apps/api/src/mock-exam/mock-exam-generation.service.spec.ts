import 'reflect-metadata'
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
import { MockLanguageModelV3 } from 'ai/test'
import type Redis from 'ioredis'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { REDIS_CLIENT } from '../redis/redis.module'
import { MockExamGenerationService } from './mock-exam-generation.service'
import {
  buildMockQuestion,
  CORRECT_ANSWER,
  configureTestEnv,
  createMockEmbeddingModel,
  extractMessageText,
  FINISH_REASON_STOP,
  PASS_VERDICT,
  truncateTables,
} from './test/mock-exam-test-utils'

const FAIL_VERDICT = JSON.stringify({
  pass: false,
  score: 0.1,
  distractorFindings: [],
})

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

    configureTestEnv(postgresContainer, redisContainer)

    const orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: postgresContainer.getHost(),
      port: postgresContainer.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    await orm.close()

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
        getEmbeddingModel: vi.fn().mockReturnValue(createMockEmbeddingModel()),
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

    it('generates distinct questions for multiple slots of the same domain (no cache collision)', async () => {
      const cert = await seedCert('GEN-DISTINCT-01')
      // Two chunks per domain — enough for two distinct questions per domain
      await seedChunk(cert.id, 'Security')
      await seedChunk(cert.id, 'Security')
      await seedChunk(cert.id, 'Networking')
      await seedChunk(cert.id, 'Networking')
      const userId = await seedUser()
      const { attemptId } = await seedAttempt(userId, cert)

      // RED: both Security slots currently hit the same cache key and return the
      // same cached question, so provenance.sourceChunkIds[0] is identical for
      // both Security questions. After the fix, the second slot excludes the
      // first slot's source chunks, producing a different cache key and thus a
      // distinct question.
      await service.generateQuestionsForAttempt(attemptId)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(4)

      const securityQuestions = attempt.questions.filter((q) => q.domain === 'Security')
      expect(securityQuestions).toHaveLength(2)

      const sourceChunkIds = securityQuestions.map((q) => q.provenance.sourceChunkIds[0])
      expect(new Set(sourceChunkIds).size).toBe(2)
    })
  })
})
