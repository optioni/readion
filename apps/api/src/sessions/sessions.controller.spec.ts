import { MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { bootstrapApp } from '../bootstrap'
import { ProviderAdapter } from '../llm/provider-adapter'
import { REDIS_CLIENT } from '../redis/redis.module'

describe('SessionsController (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let app: INestApplication
  let redis: Redis
  let orm: MikroORM

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

    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: dbHost,
      port: dbPort,
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    await orm.close()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProviderAdapter)
      .useValue(makeMockProvider())
      .compile()

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()

    redis = moduleRef.get<Redis>(REDIS_CLIENT)
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

  async function registerAndLogin(email: string, password = 'correcthorse') {
    const res = await supertest(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
    return res.body.data.accessToken as string
  }

  async function seedCert(code: string): Promise<string> {
    const em = app.get(MikroORM).em.fork()
    const cert = em.create(Certification, {
      name: `Cert ${code}`,
      provider: 'AWS',
      code,
      domains: [{ name: 'Security', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
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

  async function createSession(token: string, enrollmentId: string) {
    return supertest(app.getHttpServer())
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ durationMinutes: 30 })
  }

  describe('POST /user-certifications/:enrollmentId/sessions', () => {
    it('creates a session for the authenticated user', async () => {
      const certId = await seedCert('CTRL-01')
      const token = await registerAndLogin('ctrl-create@example.com')
      const enrollmentId = await enroll(token, certId)

      const res = await createSession(token, enrollmentId)

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('active')
      expect(res.body.relationships.items).toBeDefined()
    })

    it("returns 404 for another user's enrollment", async () => {
      const certId = await seedCert('CTRL-02')
      const owner = await registerAndLogin('ctrl-owner@example.com')
      const other = await registerAndLogin('ctrl-other@example.com')
      const enrollmentId = await enroll(owner, certId)

      const res = await createSession(other, enrollmentId)

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid durationMinutes', async () => {
      const certId = await seedCert('CTRL-03')
      const token = await registerAndLogin('ctrl-invalid@example.com')
      const enrollmentId = await enroll(token, certId)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ durationMinutes: 45 })

      expect(res.status).toBe(422)
      expect(res.body.errors).toBeDefined()
    })
  })

  describe('GET /sessions/:id', () => {
    it('returns the session with items when ?include=items', async () => {
      const certId = await seedCert('CTRL-04')
      const token = await registerAndLogin('ctrl-get@example.com')
      const enrollmentId = await enroll(token, certId)
      const createRes = await createSession(token, enrollmentId)
      const sessionId = createRes.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}?include=items`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.items)).toBe(true)
    })

    it("returns 404 for another user's session", async () => {
      const certId = await seedCert('CTRL-05')
      const owner = await registerAndLogin('ctrl-own2@example.com')
      const other = await registerAndLogin('ctrl-oth2@example.com')
      const enrollmentId = await enroll(owner, certId)
      const createRes = await createSession(owner, enrollmentId)
      const sessionId = createRes.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${other}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /sessions (history list)', () => {
    it('returns paginated session history for the user', async () => {
      const certId = await seedCert('CTRL-06')
      const token = await registerAndLogin('ctrl-list@example.com')
      const enrollmentId = await enroll(token, certId)
      const created = await createSession(token, enrollmentId)
      await supertest(app.getHttpServer())
        .post(`/api/v1/sessions/${created.body.data.id}/end`)
        .set('Authorization', `Bearer ${token}`)

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/sessions')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.meta.total).toBe(1)
    })

    it('does not include other users sessions', async () => {
      const certId = await seedCert('CTRL-07')
      const user1 = await registerAndLogin('ctrl-u1@example.com')
      const user2 = await registerAndLogin('ctrl-u2@example.com')
      const enrollment1 = await enroll(user1, certId)
      const enrollment2 = await enroll(user2, certId)
      await createSession(user1, enrollment1)
      await createSession(user2, enrollment2)

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/sessions')
        .set('Authorization', `Bearer ${user1}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
    })

    it('supports status filter', async () => {
      const certId = await seedCert('CTRL-08')
      const token = await registerAndLogin('ctrl-filter@example.com')
      const enrollmentId = await enroll(token, certId)
      await createSession(token, enrollmentId)

      const active = await supertest(app.getHttpServer())
        .get('/api/v1/sessions?status=active')
        .set('Authorization', `Bearer ${token}`)
      const abandoned = await supertest(app.getHttpServer())
        .get('/api/v1/sessions?status=abandoned')
        .set('Authorization', `Bearer ${token}`)

      expect(active.body.data.length).toBe(1)
      expect(abandoned.body.data.length).toBe(0)
    })
  })

  describe('POST /sessions/:id/end', () => {
    it('ends an active session', async () => {
      const certId = await seedCert('CTRL-09')
      const token = await registerAndLogin('ctrl-end@example.com')
      const enrollmentId = await enroll(token, certId)
      const created = await createSession(token, enrollmentId)
      const sessionId = created.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.endedAt).not.toBeNull()
    })

    it("returns 404 for another user's session", async () => {
      const certId = await seedCert('CTRL-10')
      const owner = await registerAndLogin('ctrl-end-own@example.com')
      const other = await registerAndLogin('ctrl-end-oth@example.com')
      const enrollmentId = await enroll(owner, certId)
      const created = await createSession(owner, enrollmentId)
      const sessionId = created.body.data.id as string

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${other}`)

      expect(res.status).toBe(404)
    })
  })
})

function makeMockProvider() {
  const MOCK_READING_BLOCK = JSON.stringify({
    markdown: '## Overview\n\nKey concepts.',
    tldr: ['Point 1', 'Point 2'],
    supportingSpans: ['Key concepts'],
  })

  const MOCK_VERIFIER_VERDICT = JSON.stringify({
    pass: true,
    score: 1.0,
    distractorFindings: [],
  })

  function buildMockQuizItem(sourceChunkId: string): string {
    return JSON.stringify({
      question: 'Test question?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: '',
      supportingSpans: [''],
      sourceChunkIds: [sourceChunkId],
    })
  }

  return {
    getChatModel: vi.fn().mockReturnValue({
      specificationVersion: 'v1' as const,
      provider: 'mock',
      modelId: 'mock-model',
      defaultObjectGenerationMode: undefined,
      doGenerate: async ({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) => {
        const allText = prompt
          .flatMap((msg) => {
            if (Array.isArray(msg.content)) {
              return (msg.content as Array<{ type: string; text?: string }>)
                .filter((p) => p.type === 'text')
                .map((p) => p.text ?? '')
            }
            return [typeof msg.content === 'string' ? msg.content : '']
          })
          .join('\n')

        let text: string
        if (allText.includes('independent answer verifier') || allText.includes('Verify:')) {
          text = MOCK_VERIFIER_VERDICT
        } else if (allText.includes('quiz question')) {
          const chunkIdMatch = allText.match(
            /\[(?:Source: )?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/,
          )
          text = buildMockQuizItem(chunkIdMatch?.[1] ?? '00000000-0000-0000-0000-000000000000')
        } else {
          text = MOCK_READING_BLOCK
        }

        return {
          content: [{ type: 'text', text }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 20, text: 20, reasoning: 0 },
          },
          warnings: [],
        }
      },
      doStream: async () => {
        throw new Error('doStream not supported in mock')
      },
    }),
    getEmbeddingModel: vi.fn().mockReturnValue({
      specificationVersion: 'v2' as const,
      provider: 'mock',
      modelId: 'mock-embedding',
      maxEmbeddingsPerCall: 100,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => new Array(1536).fill(0.1)),
        usage: { tokens: values.length * 10 },
        warnings: [],
      }),
    }),
  }
}
