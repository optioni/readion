import { MikroORM } from '@mikro-orm/core'
import { getQueueToken } from '@nestjs/bullmq'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
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
import { REDIS_CLIENT } from '../redis/redis.module'

describe('EnrollmentMockExamController (integration)', () => {
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
      questionCount: 2,
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

  describe('POST /api/v1/user-certifications/:id/mock-exams', () => {
    it('returns 201 with in_progress mock attempt and enqueues a generation job', async () => {
      const certId = await seedCert('MOCK-CTRL-01')
      const token = await registerAndLogin('mock-ctrl-create@example.com')
      const enrollmentId = await enroll(token, certId)

      const addSpy = vi.spyOn(queue, 'add')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(201)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.status).toBe('in_progress')
      expect(res.body.data.type).toBe('mock')
      expect(res.body.data.deadline).toBeNull()
      expect(res.body.data.questions).toHaveLength(0)

      const mockId = res.body.data.id as string
      expect(addSpy).toHaveBeenCalledWith(
        expect.any(String),
        { attemptId: mockId },
        expect.anything(),
      )

      addSpy.mockRestore()
    })

    it("returns 404 when creating a mock exam for another user's enrollment", async () => {
      const certId = await seedCert('MOCK-CTRL-02')
      const owner = await registerAndLogin('mock-ctrl-owner@example.com')
      const other = await registerAndLogin('mock-ctrl-other@example.com')
      const enrollmentId = await enroll(owner, certId)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
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
