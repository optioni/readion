import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  MockExam,
  QuizResponse,
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
import { MockExamService } from './mock-exam.service'
import { MockExamAutoSubmitCron } from './mock-exam-auto-submit.cron'
import { MockExamGenerationProcessor } from './mock-exam-generation.processor'
import {
  CORRECT_ANSWER,
  configureTestEnv,
  createMockProviderValue,
  fakeJob,
  truncateTables,
} from './test/mock-exam-test-utils'

/**
 * Integration tests for MockExamAutoSubmitCron
 *
 * Covers:
 * (a) Past-deadline attempt is expired and scored
 * (b) Within-grace attempt is left untouched
 */
describe('MockExamAutoSubmitCron (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let app: INestApplication
  let cron: MockExamAutoSubmitCron
  let service: MockExamService
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

    cron = moduleRef.get(MockExamAutoSubmitCron)
    service = moduleRef.get(MockExamService)
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

  async function setDeadlineInPast(mockId: string, offsetMs: number): Promise<void> {
    const fork = em.fork()
    const conn = fork.getConnection()
    const past = new Date(Date.now() - offsetMs)
    await conn.execute('UPDATE mock_exams SET deadline = ? WHERE id = ?', [
      past.toISOString(),
      mockId,
    ])
  }

  async function getMockStatus(mockId: string): Promise<string> {
    const fork = em.fork()
    const conn = fork.getConnection()
    const rows = await conn.execute<{ status: string }[]>(
      'SELECT status FROM mock_exams WHERE id = ?',
      [mockId],
    )
    return rows[0]!.status
  }

  /**
   * (a) Past-deadline attempt is expired and scored.
   *
   * Setup: in_progress attempt with deadline well past the 120s grace window.
   * Expected: after sweep(), status='expired', scored, QuizResponses emitted,
   *           weak areas recomputed.
   */
  describe('(a) Past-deadline attempt is expired and scored', () => {
    it('expires and scores an in_progress attempt past deadline + grace, emitting QuizResponses', async () => {
      const certId = await seedCert('CRON-EXPIRE-01')
      await seedChunks(certId)

      const token = await registerAndLogin('cron-expire-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Answer question 0 correctly; leave 1–3 unanswered
      await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: CORRECT_ANSWER })

      // Set deadline to 300 seconds ago (well past the 120s default grace)
      await setDeadlineInPast(mockId, 300_000)

      await cron.sweep()

      const status = await getMockStatus(mockId)
      expect(status).toBe('expired')

      const getRes = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(getRes.status).toBe(200)
      const data = getRes.body.data as {
        status: string
        score: number
        passed: boolean
        domainBreakdown: Record<string, { correct: number; total: number; accuracy: number }>
      }
      expect(data.status).toBe('expired')
      expect(data.score).toBeCloseTo(0.25, 5)
      expect(data.passed).toBe(false)
      expect(data.domainBreakdown).toBeDefined()

      const fork = em.fork()
      const responses = await fork.find(QuizResponse, { userCertification: enrollmentId })
      expect(responses).toHaveLength(4)
      for (const r of responses) {
        expect(r.confidence).toBe(3)
      }

      const conn = fork.getConnection()
      const weakAreaRows = await conn.execute<{ domain: string; response_count: number }[]>(
        `SELECT domain, response_count FROM weak_areas WHERE user_certification_id = ?`,
        [enrollmentId],
      )
      expect(weakAreaRows.length).toBeGreaterThanOrEqual(2)
    })
  })

  /**
   * (b) Within-grace attempt is left untouched.
   *
   * Setup: in_progress attempt with deadline just 60 seconds ago (within 120s grace).
   * Expected: after sweep(), status still 'in_progress'.
   */
  describe('(b) Within-grace attempt is left untouched', () => {
    it('leaves an attempt in_progress when within the grace window', async () => {
      const certId = await seedCert('CRON-GRACE-01')
      await seedChunks(certId)

      const token = await registerAndLogin('cron-grace-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Set deadline to 60 seconds ago (within 120s default grace)
      await setDeadlineInPast(mockId, 60_000)

      await cron.sweep()

      const status = await getMockStatus(mockId)
      expect(status).toBe('in_progress')
    })
  })

  /**
   * (c) Race guard: finalizing an already-terminal attempt is a no-op.
   *
   * Simulates the cron/manual-submit race: the attempt is loaded into memory
   * as in_progress, then status is updated to 'submitted' in the DB by a
   * concurrent writer (bypassing the EM). When finalizeAttempt is called with
   * the stale in-memory entity, em.refresh detects the terminal status and
   * returns early — no duplicate QuizResponses emitted, no double recompute.
   */
  describe('(c) Race guard: double-finalize is a no-op', () => {
    it('does not emit duplicate QuizResponses when finalizeAttempt is called on a stale entity', async () => {
      const certId = await seedCert('CRON-RACE-01')
      await seedChunks(certId)

      const token = await registerAndLogin('cron-race-01@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Step 1: Load the attempt into memory (status = in_progress)
      const loadFork = em.fork()
      const attempt = await loadFork.findOne(
        MockExam,
        { id: mockId },
        { populate: ['userCertification', 'userCertification.certification'] },
      )
      expect(attempt).not.toBeNull()
      expect(attempt!.status).toBe('in_progress')

      // Step 2: A concurrent manual submit finalizes the attempt in the DB
      // (simulated via a separate EM fork — the loadFork entity is now stale)
      const submitRes = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(submitRes.status).toBe(200)

      // Step 3: Count QuizResponses after the first finalization
      const afterSubmitFork = em.fork()
      const responsesAfterSubmit = await afterSubmitFork.find(QuizResponse, {
        userCertification: enrollmentId,
      })
      const countAfterSubmit = responsesAfterSubmit.length

      // Step 4: Call finalizeAttempt with the stale entity (still shows in_progress in memory)
      // The race guard (em.refresh) should detect the real status = 'submitted' and no-op
      await service.finalizeAttempt(loadFork, attempt!, 'expired')

      // Step 5: QuizResponse count must not have increased (no duplicate emission)
      const afterCronFork = em.fork()
      const responsesAfterCron = await afterCronFork.find(QuizResponse, {
        userCertification: enrollmentId,
      })
      expect(responsesAfterCron.length).toBe(countAfterSubmit)

      // Step 6: Attempt status remains 'submitted', not overwritten to 'expired'
      const finalStatus = await getMockStatus(mockId)
      expect(finalStatus).toBe('submitted')
    })

    it('skips a cron sweep that finds only terminal attempts (no re-scoring via SELECT)', async () => {
      const certId = await seedCert('CRON-RACE-02')
      await seedChunks(certId)

      const token = await registerAndLogin('cron-race-02@example.com')
      const enrollmentId = await enroll(token, certId)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Submit manually (status → submitted)
      const submitRes = await supertest(app.getHttpServer())
        .post(`/api/v1/mock-exams/${mockId}/submit`)
        .set('Authorization', `Bearer ${token}`)
      expect(submitRes.status).toBe(200)

      const afterSubmitFork = em.fork()
      const responsesAfterSubmit = await afterSubmitFork.find(QuizResponse, {
        userCertification: enrollmentId,
      })
      const countAfterSubmit = responsesAfterSubmit.length

      // Cron sweep runs with a far-future now → would pick up this attempt IF it were in_progress
      // But since it's 'submitted', the cron's SELECT excludes it
      await setDeadlineInPast(mockId, 300_000)
      await cron.sweep()

      const afterCronFork = em.fork()
      const responsesAfterCron = await afterCronFork.find(QuizResponse, {
        userCertification: enrollmentId,
      })
      expect(responsesAfterCron.length).toBe(countAfterSubmit)

      const finalStatus = await getMockStatus(mockId)
      expect(finalStatus).toBe('submitted')
    })
  })

  /**
   * (d) Diagnostic null-deadline: cron never touches it.
   *
   * Diagnostics have no deadline (deadline = null). The cron's WHERE clause
   * filters on `deadline < cutoff`, which evaluates to NULL for null-deadline
   * rows, so they are never selected. This test verifies that behaviour.
   */
  describe('(d) Diagnostic null-deadline: cron never touches it', () => {
    it('leaves an in_progress diagnostic with null deadline untouched', async () => {
      const certId = await seedCert('CRON-DIAG-NULL-01')

      const token = await registerAndLogin('cron-diag-null-01@example.com')
      const enrollmentId = await enroll(token, certId)

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
        status: 'in_progress',
        startedAt: null,
        deadline: null,
        domainBreakdown: {},
        questions: [],
      })
      fork.persist(attempt)
      await fork.flush()

      const farFutureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await cron.sweep(farFutureDate)

      const status = await getMockStatus(attempt.id)
      expect(status).toBe('in_progress')
    })
  })
})
