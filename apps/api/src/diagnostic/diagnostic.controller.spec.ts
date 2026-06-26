import { MikroORM } from '@mikro-orm/core'
import { getQueueToken } from '@nestjs/bullmq'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  Certification,
  MockExam,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import type { Queue } from 'bullmq'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { configureTestEnv, createMockProviderValue } from '../mock-exam/test/mock-exam-test-utils'
import { REDIS_CLIENT } from '../redis/redis.module'

describe('DiagnosticController (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let app: INestApplication
  let redis: Redis
  let orm: MikroORM
  let queue: Queue

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])

    configureTestEnv(postgresContainer, redisContainer)

    orm = await MikroORM.init({
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

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()

    redis = moduleRef.get<Redis>(REDIS_CLIENT)
    queue = moduleRef.get<Queue>(getQueueToken(MOCK_EXAM_GENERATION_QUEUE))
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await redis.flushdb()
    const conn = app.get(MikroORM).em.getConnection()
    const tables: { tablename: string }[] = await conn.execute(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'mikro_orm_migrations'
    `)
    if (tables.length > 0) {
      const names = tables.map((t) => `"${t.tablename}"`).join(', ')
      await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
    }
  })

  async function registerAndLogin(email: string, password = 'correcthorse'): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
    return res.body.data.accessToken as string
  }

  async function seedLiveCert(code: string): Promise<string> {
    const em = app.get(MikroORM).em.fork()
    const cert = em.create(Certification, {
      name: `Cert ${code}`,
      provider: 'AWS',
      code,
      domains: [
        { name: 'Security', weight: 50 },
        { name: 'Networking', weight: 50 },
      ],
      questionCount: 12,
      passingScore: 700,
      timeLimitMinutes: 10,
      provenance: 'verified',
      state: 'live' as const,
    })
    em.persist(cert)
    await em.flush()
    return cert.id
  }

  async function enroll(token: string, certId: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/user-certifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ certificationId: certId })
    return res.body.data.id as string
  }

  describe('POST /api/v1/user-certifications/:id/diagnostic', () => {
    it('returns 201 with in_progress diagnostic attempt and enqueues a generation job', async () => {
      const certId = await seedLiveCert('DIAG-CTRL-01')
      const token = await registerAndLogin('diag-ctrl-create@example.com')
      const enrollmentId = await enroll(token, certId)

      const addSpy = vi.spyOn(queue, 'add')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/diagnostic`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(201)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.type).toBe('diagnostic')
      expect(res.body.data.status).toBe('in_progress')
      expect(res.body.data.deadline).toBeNull()
      expect(res.body.data.questions).toHaveLength(0)
      expect(res.body.data.generation).toBe('preparing')

      const diagnosticId = res.body.data.id as string
      expect(addSpy).toHaveBeenCalledWith(
        expect.any(String),
        { attemptId: diagnosticId },
        expect.anything(),
      )

      addSpy.mockRestore()
    })

    it('returns 409 when the certification is in draft state', async () => {
      const registerRes = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'diag-ctrl-draft@example.com', password: 'correcthorse' })
      const token = registerRes.body.data.accessToken as string
      const userId = registerRes.body.data.user.id as string

      const em = app.get(MikroORM).em.fork()
      const draftCert = em.create(Certification, {
        name: 'Draft Cert DIAG-CTRL-02',
        provider: 'AWS',
        code: 'DIAG-CTRL-02',
        domains: [{ name: 'Security', weight: 100 }],
        questionCount: 12,
        passingScore: 700,
        timeLimitMinutes: 10,
        provenance: 'verified',
        state: 'draft' as const,
      })

      const userRef = em.getReference(User, userId)
      const uc = em.create(UserCertification, {
        user: userRef,
        certification: draftCert,
        status: 'active' as const,
      })
      em.persist(draftCert)
      em.persist(uc)
      await em.flush()

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${uc.id}/diagnostic`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(409)
    })

    it("returns 404 when posting to another user's enrollment", async () => {
      const certId = await seedLiveCert('DIAG-CTRL-03')
      const ownerToken = await registerAndLogin('diag-ctrl-owner@example.com')
      const otherToken = await registerAndLogin('diag-ctrl-other@example.com')
      const enrollmentId = await enroll(ownerToken, certId)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/diagnostic`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/v1/user-certifications/:id/diagnostic-offer', () => {
    async function seedSubmittedDiagnostic(userId: string, enrollmentId: string): Promise<void> {
      const em = app.get(MikroORM).em.fork()
      const attempt = em.create(MockExam, {
        user: em.getReference(User, userId),
        userCertification: em.getReference(UserCertification, enrollmentId),
        type: 'diagnostic',
        status: 'submitted',
        startedAt: new Date(),
        deadline: null,
        score: 0.8,
        passed: null,
        domainBreakdown: {},
        questions: [],
      })
      em.persist(attempt)
      await em.flush()
    }

    async function seedCompletedSession(userId: string, enrollmentId: string): Promise<void> {
      const em = app.get(MikroORM).em.fork()
      const session = em.create(StudySession, {
        user: em.getReference(User, userId),
        userCertification: em.getReference(UserCertification, enrollmentId),
        kind: 'study',
        status: 'completed',
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'medium',
        focusArea: { type: 'weakest' },
        learningStyle: 'visual',
        startedAt: new Date(),
        endedAt: new Date(),
      })
      em.persist(session)
      await em.flush()
    }

    it('(d) returns onboarding offer when cert is live and no completed diagnostic', async () => {
      const certId = await seedLiveCert('DIAG-OFFER-01')
      const token = await registerAndLogin('diag-offer-onboarding@example.com')
      const enrollmentId = await enroll(token, certId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.offer).toBe('onboarding')
    })

    it('(e) returns none when diagnostic is completed but session count is below threshold', async () => {
      const registerRes = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'diag-offer-none@example.com', password: 'correcthorse' })
      const token = registerRes.body.data.accessToken as string
      const userId = registerRes.body.data.user.id as string

      const certId = await seedLiveCert('DIAG-OFFER-02')
      const enrollmentId = await enroll(token, certId)

      await seedSubmittedDiagnostic(userId, enrollmentId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.offer).toBe('none')
    })

    it('(f) returns re-prompt after completing enough sessions', async () => {
      const registerRes = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'diag-offer-reprompt@example.com', password: 'correcthorse' })
      const token = registerRes.body.data.accessToken as string
      const userId = registerRes.body.data.user.id as string

      const certId = await seedLiveCert('DIAG-OFFER-03')
      const enrollmentId = await enroll(token, certId)

      await seedSubmittedDiagnostic(userId, enrollmentId)
      await seedCompletedSession(userId, enrollmentId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.offer).toBe('re-prompt')
    })

    it("(h) returns 404 when accessing another user's enrollment", async () => {
      const certId = await seedLiveCert('DIAG-OFFER-04')
      const ownerToken = await registerAndLogin('diag-offer-owner@example.com')
      const otherToken = await registerAndLogin('diag-offer-other@example.com')
      const enrollmentId = await enroll(ownerToken, certId)

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/user-certifications/:id/diagnostic-offer/dismiss', () => {
    async function seedSubmittedDiagnostic(userId: string, enrollmentId: string): Promise<void> {
      const em = app.get(MikroORM).em.fork()
      const attempt = em.create(MockExam, {
        user: em.getReference(User, userId),
        userCertification: em.getReference(UserCertification, enrollmentId),
        type: 'diagnostic',
        status: 'submitted',
        startedAt: new Date(),
        deadline: null,
        score: 0.8,
        passed: null,
        domainBreakdown: {},
        questions: [],
      })
      em.persist(attempt)
      await em.flush()
    }

    async function seedCompletedSession(userId: string, enrollmentId: string): Promise<void> {
      const em = app.get(MikroORM).em.fork()
      const session = em.create(StudySession, {
        user: em.getReference(User, userId),
        userCertification: em.getReference(UserCertification, enrollmentId),
        kind: 'study',
        status: 'completed',
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'medium',
        focusArea: { type: 'weakest' },
        learningStyle: 'visual',
        startedAt: new Date(),
        endedAt: new Date(),
      })
      em.persist(session)
      await em.flush()
    }

    it('(g) dismiss stamps diagnosticRePromptedAt and subsequent offer returns none', async () => {
      const registerRes = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'diag-offer-dismiss@example.com', password: 'correcthorse' })
      const token = registerRes.body.data.accessToken as string
      const userId = registerRes.body.data.user.id as string

      const certId = await seedLiveCert('DIAG-OFFER-05')
      const enrollmentId = await enroll(token, certId)

      await seedSubmittedDiagnostic(userId, enrollmentId)
      await seedCompletedSession(userId, enrollmentId)

      const offerBefore = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${token}`)
      expect(offerBefore.body.data.offer).toBe('re-prompt')

      const dismissRes = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer/dismiss`)
        .set('Authorization', `Bearer ${token}`)
      expect(dismissRes.status).toBe(200)

      const offerAfter = await supertest(app.getHttpServer())
        .get(`/api/v1/user-certifications/${enrollmentId}/diagnostic-offer`)
        .set('Authorization', `Bearer ${token}`)
      expect(offerAfter.status).toBe(200)
      expect(offerAfter.body.data.offer).toBe('none')
    })
  })
})
