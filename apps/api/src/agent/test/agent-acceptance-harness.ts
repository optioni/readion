import 'reflect-metadata'
import type {
  EmbeddingModelV3Result,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type Redis from 'ioredis'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ProviderAdapter } from '../../llm/provider-adapter'
import { REDIS_CLIENT } from '../../redis/redis.module'

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }
const FINISH_REASON_TOOL_CALLS: LanguageModelV3FinishReason = {
  unified: 'tool-calls',
  raw: 'tool_calls',
}

const STREAM_USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
} as const

function streamFromParts(parts: LanguageModelV3StreamPart[]) {
  return new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part)
      }
      controller.close()
    },
  })
}

function textReplyParts(deltas: string[]): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'txt-1' },
    ...deltas.map(
      (delta): LanguageModelV3StreamPart => ({ type: 'text-delta', id: 'txt-1', delta }),
    ),
    { type: 'text-end', id: 'txt-1' },
    { type: 'finish', finishReason: FINISH_REASON_STOP, usage: STREAM_USAGE },
  ]
}

function toolCallParts(toolName: string, input: string): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-input-start', id: 'call-1', toolName },
    { type: 'tool-input-delta', id: 'call-1', delta: input },
    { type: 'tool-input-end', id: 'call-1' },
    { type: 'tool-call', toolCallId: 'call-1', toolName, input },
    { type: 'finish', finishReason: FINISH_REASON_TOOL_CALLS, usage: STREAM_USAGE },
  ]
}

type StreamArgs = {
  prompt: Array<{ role: string; content: unknown }>
  tools?: Array<{ name: string }>
}

export const FAIL_MARKER = '__FAIL__'

export type AgentMessageRow = {
  id: string
  role: string
  content: unknown
  created_at: string
}

export type AgentConversationRow = {
  id: string
  user_id: string
  study_session_id: string | null
  certification_id: string | null
  mode: string
  last_activity_at: string
  deleted_at: string | null
}

export type AgentAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  resetState: () => Promise<void>
  teardown: () => Promise<void>
  registerAndLogin: (email: string, password: string) => Promise<string>
  getUserIdFromToken: (token: string) => Promise<string>
  enroll: (token: string, certificationId: string) => Promise<string>
  seedCertification: (code: string, state: 'live' | 'draft') => Promise<Certification>
  seedChunk: (certId: string, domain: string) => Promise<string>
  seedWeakArea: (enrollmentId: string, domain: string, score: number) => Promise<void>
  seedDiagnostic: (enrollmentId: string, userId: string, score: number) => Promise<void>
  seedStudySession: (
    enrollmentId: string,
    userId: string,
    chunkId: string,
  ) => Promise<{ sessionId: string; itemIndex: number }>
  getAgentMessages: (conversationId: string) => Promise<AgentMessageRow[]>
  getConversation: (conversationId: string) => Promise<AgentConversationRow | undefined>
  getRequest: () => ReturnType<typeof supertest>
}

export async function createAgentAcceptanceHarness(): Promise<AgentAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const mockEmbeddingModel = new MockEmbeddingModelV3({
    doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
      embeddings: values.map(() => new Array(1536).fill(0.1)),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  })

  // Scripted streaming LLM. In-session turns (non-empty tool set) first emit a deterministic
  // tool-call, then on the follow-up step (prompt now carries a tool-result) emit text deltas.
  // Standalone turns (empty tool set) reply with text directly.
  const mockLangModel = new MockLanguageModelV3({
    doStream: async ({ prompt, tools }: StreamArgs) => {
      const hasTools = Array.isArray(tools) && tools.length > 0
      const hasToolResult = prompt.some((msg) => msg.role === 'tool')

      if (JSON.stringify(prompt).includes(FAIL_MARKER)) {
        return {
          stream: streamFromParts([
            { type: 'stream-start', warnings: [] },
            { type: 'error', error: new Error('mock stream failure') },
          ]),
        }
      }

      if (hasTools && !hasToolResult) {
        return { stream: streamFromParts(toolCallParts('getUserProgress', '{}')) }
      }

      const deltas = hasTools
        ? ['Based ', 'on your ', 'progress, ', 'focus on Security.']
        : ['Hello! ', 'Here is a ', 'general answer.']
      return { stream: streamFromParts(textReplyParts(deltas)) }
    },
  })

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ProviderAdapter)
    .useValue({
      getChatModel: vi.fn().mockReturnValue(mockLangModel),
      getEmbeddingModel: vi.fn().mockReturnValue(mockEmbeddingModel),
    })
    .compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)

  return {
    app,
    moduleRef,
    resetState: async () => {
      await redis.flushdb()
      await truncateDomainTables(em)
    },
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    registerAndLogin: async (email: string, password: string) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password })
      return res.body.data.accessToken as string
    },
    getUserIdFromToken: async (token: string) => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
      return res.body.data.id as string
    },
    enroll: async (token: string, certificationId: string) => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/user-certifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ certificationId })
      return res.body.data.id as string
    },
    seedCertification: async (code: string, state: 'live' | 'draft') => {
      const fork = em.fork()
      const cert = fork.create(Certification, {
        name: `Cert ${code}`,
        provider: 'AWS',
        code,
        domains: [
          { name: 'Security', weight: 60 },
          { name: 'Networking', weight: 40 },
        ],
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: 'verified',
        state,
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
          `Study content for ${domain}: key concepts and examples.`,
          `hash-${Math.random()}`,
          vectorLiteral,
          JSON.stringify([{ domain, confidence: 1.0 }]),
          domain,
        ],
      )
      return chunkResult[0]!.id
    },
    seedWeakArea: async (enrollmentId: string, domain: string, score: number) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute(
        `INSERT INTO weak_areas (id, user_certification_id, domain, score, accuracy, mean_confidence, response_count, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, 0.5, 0.5, 3, now(), now())
         ON CONFLICT (user_certification_id, domain) DO UPDATE SET score = EXCLUDED.score`,
        [enrollmentId, domain, score],
      )
    },
    seedDiagnostic: async (enrollmentId: string, userId: string, score: number) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      await conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, score, passed, domain_breakdown, questions, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'diagnostic', 'submitted', ?, ?, '{}'::jsonb, '[]'::jsonb, now(), now())`,
        [userId, enrollmentId, score, score >= 70],
      )
    },
    seedStudySession: async (enrollmentId: string, userId: string, chunkId: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const sessionResult = await conn.execute<{ id: string }[]>(
        `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', ?::jsonb, 'weak-area-focus', 0, now(), now(), now())
         RETURNING id`,
        [enrollmentId, userId, JSON.stringify({ mode: 'auto' })],
      )
      const sessionId = sessionResult[0]!.id

      await conn.execute(
        `INSERT INTO session_items (id, session_id, index, type, content, completed, source_chunk_ids, supporting_spans, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 0, 'reading', ?, false, ?::jsonb, ?::jsonb, now(), now())`,
        [
          sessionId,
          'Reading block about Security fundamentals.',
          JSON.stringify([chunkId]),
          JSON.stringify(['Security fundamentals']),
        ],
      )

      const quizContent = JSON.stringify({
        question: 'Which control protects data at rest?',
        options: ['Encryption', 'Logging', 'Caching', 'Throttling'],
        correctAnswer: 'Encryption',
      })
      await conn.execute(
        `INSERT INTO session_items (id, session_id, index, type, content, completed, source_chunk_ids, supporting_spans, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 1, 'quiz', ?, false, ?::jsonb, ?::jsonb, now(), now())`,
        [
          sessionId,
          quizContent,
          JSON.stringify([chunkId]),
          JSON.stringify(['Encryption protects data at rest']),
        ],
      )

      return { sessionId, itemIndex: 1 }
    },
    getAgentMessages: async (conversationId: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      return conn.execute<AgentMessageRow[]>(
        `SELECT id, role, content, created_at
         FROM agent_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC, id ASC`,
        [conversationId],
      )
    },
    getConversation: async (conversationId: string) => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const rows = await conn.execute<AgentConversationRow[]>(
        `SELECT id, user_id, study_session_id, certification_id, mode, last_activity_at, deleted_at
         FROM agent_conversations
         WHERE id = ?`,
        [conversationId],
      )
      return rows[0]
    },
    getRequest: () => supertest(app.getHttpServer()),
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
  if (tables.length === 0) return
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
}
