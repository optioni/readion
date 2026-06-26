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

const ALT_ANSWER = 'Option B'

describe('PUT /api/v1/mock-exams/:id/answers/:questionIndex (integration)', () => {
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

    const orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: postgresContainer.getHost(),
      port: postgresContainer.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    await orm.close()

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

  async function setAttemptStatus(
    mockId: string,
    status: 'in_progress' | 'submitted' | 'expired',
  ): Promise<void> {
    const fork = em.fork()
    const conn = fork.getConnection()
    await conn.execute('UPDATE mock_exams SET status = ? WHERE id = ?', [status, mockId])
  }

  async function setAttemptDeadlineToPast(mockId: string): Promise<void> {
    const fork = em.fork()
    const conn = fork.getConnection()
    await conn.execute(
      "UPDATE mock_exams SET deadline = now() - interval '1 second' WHERE id = ?",
      [mockId],
    )
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

  describe('(a) Saving and overwriting an answer', () => {
    it('returns 200 for the first answer and 200 for an overwrite, persisting only the latest', async () => {
      const cert = await seedCert('ANSWER-UPSERT-01')
      await seedChunks(cert.id)

      const token = await registerAndLogin('answer-upsert-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // First answer
      const first = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: CORRECT_ANSWER })

      expect(first.status).toBe(200)
      expect(first.body.data).toBeDefined()
      expect(first.body.data.questions[0].userAnswer).toBe(CORRECT_ANSWER)

      // Overwrite with a different answer
      const second = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: ALT_ANSWER })

      expect(second.status).toBe(200)
      expect(second.body.data.questions[0].userAnswer).toBe(ALT_ANSWER)

      // Verify no duplicate: GET the attempt and confirm only one answer on question 0
      const get = await supertest(app.getHttpServer())
        .get(`/api/v1/mock-exams/${mockId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(get.status).toBe(200)
      const questions = get.body.data.questions as Array<{ userAnswer: string | null }>
      expect(questions[0]!.userAnswer).toBe(ALT_ANSWER)
      // All other questions remain unanswered
      expect(questions[1]!.userAnswer).toBeNull()
      expect(questions[2]!.userAnswer).toBeNull()
      expect(questions[3]!.userAnswer).toBeNull()
    })
  })

  describe('(b) Answering a terminal attempt is rejected', () => {
    it('returns 409 for a submitted attempt and records no answer', async () => {
      const cert = await seedCert('ANSWER-TERMINAL-01')
      await seedChunks(cert.id)

      const token = await registerAndLogin('answer-terminal-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)
      await setAttemptStatus(mockId, 'submitted')

      const res = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: CORRECT_ANSWER })

      expect(res.status).toBe(409)

      // Confirm no answer was recorded
      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: mockId })
      expect(attempt.questions[0]!.selectedAnswer).toBeNull()
    })

    it('returns 409 for an expired attempt and records no answer', async () => {
      const cert = await seedCert('ANSWER-TERMINAL-02')
      await seedChunks(cert.id)

      const token = await registerAndLogin('answer-terminal-02@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)
      await setAttemptStatus(mockId, 'expired')

      const res = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: CORRECT_ANSWER })

      expect(res.status).toBe(409)

      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: mockId })
      expect(attempt.questions[0]!.selectedAnswer).toBeNull()
    })
  })

  describe('(c) Past-deadline wall-clock close is independent of the cron', () => {
    it('returns 409 when the deadline is past even though status is still in_progress', async () => {
      const cert = await seedCert('ANSWER-DEADLINE-01')
      await seedChunks(cert.id)

      const token = await registerAndLogin('answer-deadline-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createMockExam(token, enrollmentId)
      await runGeneration(mockId)

      // Move deadline to the past without changing the status
      await setAttemptDeadlineToPast(mockId)

      // Attempt status is still in_progress, but wall-clock is past deadline
      const fork = em.fork()
      const attempt = await fork.findOneOrFail(MockExam, { id: mockId })
      expect(attempt.status).toBe('in_progress')

      const res = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: CORRECT_ANSWER })

      expect(res.status).toBe(409)

      // Confirm no answer was recorded
      const fork2 = em.fork()
      const attemptAfter = await fork2.findOneOrFail(MockExam, { id: mockId })
      expect(attemptAfter.questions[0]!.selectedAnswer).toBeNull()
    })
  })

  describe("(d) Cross-user ownership — answering another user's attempt returns 404", () => {
    it("returns 404 when a user tries to answer another user's attempt", async () => {
      const cert = await seedCert('ANSWER-XUSER-01')
      await seedChunks(cert.id)

      const owner = await registerAndLogin('answer-xuser-owner@example.com')
      const enrollmentId = await enroll(owner, cert.id)
      const mockId = await createAttemptInDb(enrollmentId)

      const other = await registerAndLogin('answer-xuser-other@example.com')
      const res = await supertest(app.getHttpServer())
        .put(`/api/v1/mock-exams/${mockId}/answers/0`)
        .set('Authorization', `Bearer ${other}`)
        .send({ answer: CORRECT_ANSWER })

      expect(res.status).toBe(404)
    })
  })

  describe('(e) No agent endpoints exist on a mock exam attempt', () => {
    it('the mock exam module exposes no agent conversation endpoints', async () => {
      const cert = await seedCert('ANSWER-NOAGENT-01')
      const token = await registerAndLogin('answer-noagent-01@example.com')
      const enrollmentId = await enroll(token, cert.id)
      const mockId = await createAttemptInDb(enrollmentId)

      const agentEndpoints = [
        `/api/v1/mock-exams/${mockId}/agent`,
        `/api/v1/mock-exams/${mockId}/agent/messages`,
        `/api/v1/mock-exams/${mockId}/conversation`,
      ]

      for (const endpoint of agentEndpoints) {
        const get = await supertest(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`)
        expect(get.status).toBe(404)

        const post = await supertest(app.getHttpServer())
          .post(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .send({})
        expect(post.status).toBe(404)
      }
    })
  })
})
