import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
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
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { REDIS_CLIENT } from '../redis/redis.module'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import {
  CORRECT_ANSWER,
  configureTestEnv,
  createMockProviderValue,
  fakeJob,
  truncateTables,
} from './test/mock-exam-test-utils'

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

    configureTestEnv(postgresContainer, redisContainer)

    await acquireIsolatedDatabase()

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProviderAdapter)
      .useValue(createMockProviderValue())
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
          options: [CORRECT_ANSWER, 'B', 'C', 'D'],
          correctAnswer: CORRECT_ANSWER,
          explanation: '',
          selectedAnswer: null,
          domain: 'Security',
          provenance: {
            sourceChunkIds: ['00000000-0000-0000-0000-000000000099'],
            supportingSpans: [CORRECT_ANSWER],
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

  /**
   * Shortfall handling: some domain slots cannot be filled.
   *
   * When a domain has no chunks, its slots return insufficient_material and are
   * skipped. The attempt must still receive startedAt/deadline after all slots
   * have been processed — it must not be stranded in the "preparing" state
   * forever just because some slots yielded no question.
   */
  describe('Shortfall handling: partial content coverage', () => {
    it('stamps deadline even when some domain slots return insufficient_material', async () => {
      const cert = await seedCert('PROC-SHORTFALL-01')
      // Only seed Networking chunks — Security slots will get insufficient_material
      await seedChunk(cert.id, 'Networking')
      await seedChunk(cert.id, 'Networking')
      const { attemptId } = await seedAttempt(cert)

      // RED: stampDeadlineIfComplete currently checks questions.length === questionCount
      // so with only 2 Networking questions (shortfall of 2 Security), it never stamps.
      await processor.process(fakeJob({ attemptId }))

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      // Only 2 questions generated (Networking only), but deadline MUST be stamped
      expect(attempt.questions).toHaveLength(2)
      expect(attempt.startedAt).not.toBeNull()
      expect(attempt.deadline).not.toBeNull()
    })
  })

  describe('diagnostic generation: breadth planner + null deadline', () => {
    async function registerAndLoginDiag(email: string): Promise<string> {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correcthorse' })
      return res.body.data.accessToken as string
    }

    async function enrollViaApi(token: string, certId: string): Promise<string> {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId: certId })
      return res.body.data.id as string
    }

    async function createDiagnosticAttemptInDb(enrollmentId: string): Promise<string> {
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
        type: 'diagnostic',
        questions: [],
        domainBreakdown: {},
      })
      fork.persist(attempt)
      await fork.flush()
      return attempt.id
    }

    async function seedDiagnosticAttemptDirect(
      cert: Certification,
    ): Promise<{ attemptId: string }> {
      const fork = em.fork()
      const user = fork.create(User, {
        email: `diag-proc-${Math.random()}@example.com`,
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
        type: 'diagnostic',
        questions: [],
        domainBreakdown: {},
      })
      fork.persist(attempt)
      await fork.flush()

      return { attemptId: attempt.id }
    }

    it('generates DIAGNOSTIC_QUESTION_COUNT (12) questions for a diagnostic attempt and stamps startedAt without deadline', async () => {
      const cert = await seedCert('DIAG-GEN-01')
      for (const domain of ['Security', 'Networking']) {
        for (let i = 0; i < 6; i++) {
          await seedChunk(cert.id, domain)
        }
      }
      const { attemptId } = await seedDiagnosticAttemptDirect(cert)

      await processor.process(fakeJob({ attemptId }))

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: attemptId })

      expect(attempt.questions).toHaveLength(12)
      expect(attempt.startedAt).not.toBeNull()
      expect(attempt.deadline).toBeNull()

      for (const q of attempt.questions) {
        expect(q.provenance.sourceChunkIds.length).toBeGreaterThan(0)
        expect(q.provenance.supportingSpans.length).toBeGreaterThan(0)
        expect(q.provenance.verdict.pass).toBe(true)
      }
    })

    it('diagnostic attempt reports generation: ready with remainingSeconds: null after generation', async () => {
      const cert = await seedCert('DIAG-HTTP-01')
      for (const domain of ['Security', 'Networking']) {
        for (let i = 0; i < 6; i++) {
          await seedChunk(cert.id, domain)
        }
      }

      const token = await registerAndLoginDiag('diag-http-01@example.com')
      const enrollmentId = await enrollViaApi(token, cert.id)
      const attemptId = await createDiagnosticAttemptInDb(enrollmentId)

      await processor.process(fakeJob({ attemptId }))

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${attemptId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.generation).toBe('ready')
      expect(res.body.data.remainingSeconds).toBeNull()
      expect(res.body.data.deadline).toBeNull()
      expect(res.body.data.startedAt).not.toBeNull()
    })
  })
})
