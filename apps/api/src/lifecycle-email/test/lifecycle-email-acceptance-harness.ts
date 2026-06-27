import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { CertificationDomain } from '@readion/shared'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { type CapturedMailMessage, MAIL_CAPTURED_MESSAGES } from '../../mail/transport'
import { REDIS_CLIENT } from '../../redis/redis.module'

// Shared secret guarding the worker -> API internal lifecycle channel. The internal
// controller's `InternalSecretGuard` reads this header and compares it (constant-time)
// against `INTERNAL_API_SECRET`.
export const INTERNAL_API_SECRET = 'test-internal-lifecycle-secret'
export const INTERNAL_SECRET_HEADER = 'x-internal-api-secret'

export type LifecycleEmailAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  clearCapturedMail: () => void
  teardown: () => Promise<void>
  getRequest: () => ReturnType<typeof supertest>
  capturedMail: () => ReadonlyArray<CapturedMailMessage>
  registerAndLogin: (email: string, password: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  verifyUserEmail: (userId: string) => Promise<void>
  seedCertification: (code: string, domains?: CertificationDomain[]) => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  seedQuizResponse: (
    enrollmentId: string,
    chunkId: string,
    correct: boolean,
    confidence: number,
  ) => Promise<void>
  seedSubmittedDiagnostic: (enrollmentId: string, userId: string, score: number) => Promise<void>
  seedDueReviewItem: (enrollmentId: string, chunkId: string, dueAt: Date) => Promise<void>
  seedPriorDigestReadiness: (enrollmentId: string, readiness: number) => Promise<void>
  enroll: (token: string, certificationId: string) => Promise<string>
}

export async function createLifecycleEmailAcceptanceHarness(): Promise<LifecycleEmailAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)
  const captured = moduleRef.get<CapturedMailMessage[]>(MAIL_CAPTURED_MESSAGES)
  const httpServer = app.getHttpServer()

  return {
    app,
    moduleRef,
    resetState: async () => {
      await redis.flushdb()
      await truncateDomainTables(em)
      captured.length = 0
    },
    clearCapturedMail: () => {
      captured.length = 0
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    getRequest: () => supertest(httpServer),
    capturedMail: () => captured,
    registerAndLogin: async (email: string, password: string) => {
      const res = await supertest(httpServer)
        .post('/api/v1/auth/register')
        .send({ email, password })
      return res.body.data.accessToken as string
    },
    getUserIdFromToken: async (token: string) => {
      const res = await supertest(httpServer)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
      return res.body.data.id as string
    },
    verifyUserEmail: async (userId: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute('UPDATE users SET email_verified = true WHERE id = ?', [userId])
    },
    seedCertification: async (
      code: string,
      domains: CertificationDomain[] = [
        { name: 'Cloud Concepts', weight: 50 },
        { name: 'Security', weight: 50 },
      ],
    ) => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains,
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
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
          `Content for domain ${domain}`,
          `hash-${Math.random()}`,
          vectorLiteral,
          JSON.stringify([{ domain, confidence: 1.0 }]),
          domain,
        ],
      )
      return chunkResult[0]!.id
    },
    seedQuizResponse: async (
      enrollmentId: string,
      chunkId: string,
      correct: boolean,
      confidence: number,
    ) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const snapshot = JSON.stringify({
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        provenance: {
          sourceChunkIds: [chunkId],
          supportingSpans: ['test span'],
          verdict: { pass: true, score: 0.9, distractorFindings: [] },
          score: 0.9,
        },
      })
      await conn.execute(
        `INSERT INTO quiz_responses (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'A', ?, ?, 5000, ?::jsonb, 'multiple_choice', now(), now())`,
        [enrollmentId, correct, confidence, snapshot],
      )
    },
    seedSubmittedDiagnostic: async (enrollmentId: string, userId: string, score: number) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, score, passed, domain_breakdown, questions, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'diagnostic', 'submitted', ?, ?, '{}'::jsonb, '[]'::jsonb, now(), now())`,
        [userId, enrollmentId, score, score >= 70],
      )
    },
    seedDueReviewItem: async (enrollmentId: string, chunkId: string, dueAt: Date) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute(
        `INSERT INTO review_items (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 1, 'active', ?, now(), now())`,
        [enrollmentId, chunkId, dueAt],
      )
    },
    seedPriorDigestReadiness: async (enrollmentId: string, readiness: number) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute('UPDATE user_certifications SET last_digest_readiness = ? WHERE id = ?', [
        readiness,
        enrollmentId,
      ])
    },
    enroll: async (token: string, certificationId: string) => {
      const res = await supertest(httpServer)
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId })
      return res.body.data.id as string
    },
  }
}

async function truncateDomainTables(em: EntityManager) {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables: { tablename: string }[] = await conn.execute(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)
  if (tables.length === 0) {
    return
  }
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}

function configureTestEnv(
  postgresContainer: StartedTestContainer,
  redisContainer: StartedTestContainer,
) {
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

  // Lifecycle-email config consumed by the digest + nudge flows.
  process.env.PUBLIC_API_URL = 'http://localhost:3001'
  process.env.INTERNAL_API_SECRET = INTERNAL_API_SECRET
  process.env.DIGEST_SEND_WEEKDAY = '1'
  process.env.DIGEST_SEND_HOUR = '8'
  process.env.EXAM_READY_THRESHOLD = '75'
  process.env.NUDGE_ACTIVITY_LULL_DAYS = '7'
  process.env.NUDGE_FOLLOWUP_DELAY_DAYS = '3'
  process.env.NUDGE_MAX_FOLLOWUPS = '1'
}
