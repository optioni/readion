import 'reflect-metadata'
import type {
  EmbeddingModelV3Result,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
  WeakArea,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import type { Queue } from 'bullmq'
import { Worker } from 'bullmq'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiConfigModule } from '../config/config.module'
import { LlmModule } from '../llm/llm.module'
import { ProviderAdapter } from '../llm/provider-adapter'
import { ApiObservabilityModule } from '../observability/observability.module'
import { QueueModule } from '../queue/queue.module'
import { RedisModule } from '../redis/redis.module'
import { AgentModule } from './agent.module'
import { AgentConversationRepository } from './agent.repository'
import { AgentService, type SseEvent } from './agent.service'
import { AGENT_MATERIAL_QUEUE_NAME } from './tools/agent-tools.config'
import { AGENT_MATERIAL_QUEUE } from './tools/agent-tools.types'

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

const FAIL_MARKER = '__FAIL__'

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

async function collect(stream: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const events: SseEvent[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe('AgentService (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let moduleRef: TestingModule
  let em: EntityManager
  let service: AgentService
  let repo: AgentConversationRepository
  let materialQueue: Queue

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

    const mockEmbeddingModel = new MockEmbeddingModelV3({
      doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
        embeddings: values.map(() => new Array(1536).fill(0.1)),
        usage: { tokens: values.length * 10 },
        warnings: [],
      }),
    })

    const mockLangModel = new MockLanguageModelV3({
      doStream: async ({ prompt, tools }: StreamArgs) => {
        const hasTools = Array.isArray(tools) && tools.length > 0
        const hasToolResult = prompt.some((msg) => msg.role === 'tool')
        const wantsFailure = JSON.stringify(prompt).includes(FAIL_MARKER)

        if (wantsFailure) {
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

    moduleRef = await Test.createTestingModule({
      imports: [
        ApiConfigModule,
        ApiObservabilityModule.forRoot(),
        RedisModule,
        QueueModule,
        LlmModule,
        AgentModule,
      ],
    })
      .overrideProvider(ProviderAdapter)
      .useValue({
        getChatModel: vi.fn().mockReturnValue(mockLangModel),
        getEmbeddingModel: vi.fn().mockReturnValue(mockEmbeddingModel),
      })
      .compile()

    await moduleRef.init()

    em = moduleRef.get(EntityManager)
    service = moduleRef.get(AgentService)
    repo = moduleRef.get(AgentConversationRepository)
    materialQueue = moduleRef.get(AGENT_MATERIAL_QUEUE)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    const fork = em.fork()
    const conn = fork.getConnection()
    const tables: { tablename: string }[] = await conn.execute(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != 'mikro_orm_migrations'
    `)
    if (tables.length > 0) {
      const names = tables.map((t) => `"${t.tablename}"`).join(', ')
      await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
    }
    fork.clear()
  })

  async function seedInSession(): Promise<{
    userId: string
    certId: string
    enrollmentId: string
    sessionId: string
  }> {
    const fork = em.fork()
    const user = fork.create(User, {
      email: `agent-${Math.random()}@example.com`,
      passwordHash: 'x',
    })
    const cert = fork.create(Certification, {
      name: 'Cert CLF',
      provider: 'AWS',
      code: `CLF-${Math.random()}`,
      domains: [
        { name: 'Security', weight: 60 },
        { name: 'Networking', weight: 40 },
      ],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
    })
    fork.persist([user, cert])
    await fork.flush()

    const enrollment = fork.create(UserCertification, { user, certification: cert })
    fork.persist(enrollment)
    await fork.flush()

    const weakArea = fork.create(WeakArea, {
      userCertification: enrollment,
      domain: 'Security',
      score: 0.3,
      accuracy: 0.5,
      meanConfidence: 0.5,
      responseCount: 3,
    })
    const session = fork.create(StudySession, {
      userCertification: enrollment,
      user,
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: { mode: 'auto' },
      learningStyle: 'weak-area-focus',
      startedAt: new Date(),
    })
    fork.persist([weakArea, session])
    await fork.flush()

    return { userId: user.id, certId: cert.id, enrollmentId: enrollment.id, sessionId: session.id }
  }

  async function seedUser(): Promise<string> {
    const fork = em.fork()
    const user = fork.create(User, {
      email: `agent-${Math.random()}@example.com`,
      passwordHash: 'x',
    })
    fork.persist(user)
    await fork.flush()
    return user.id
  }

  it('streams a tooled in-session turn and persists ordered messages', async () => {
    const { userId, certId, sessionId } = await seedInSession()
    const conversation = await repo.createConversation({
      userId,
      mode: 'in_session',
      studySessionId: sessionId,
      certificationId: certId,
    })

    const events = await collect(
      service.runTurn({ userId, conversationId: conversation.id, content: 'Where am I weakest?' }),
    )

    const types = events.map((e) => e.type)
    expect(types.some((t) => t.includes('text-delta'))).toBe(true)
    expect(types.some((t) => t.includes('tool'))).toBe(true)
    expect(types.some((t) => t.includes('tool-result') || t.includes('tool-output'))).toBe(true)
    expect(types.some((t) => t === 'finish' || t.endsWith('finish'))).toBe(true)

    const messages = await repo.loadMessages(userId, conversation.id)
    const roles = messages.map((m) => m.role)
    expect(roles[0]).toBe('user')
    expect(roles).toContain('tool')
    expect(roles).toContain('assistant')
    expect(roles.indexOf('user')).toBeLessThan(roles.lastIndexOf('assistant'))

    const refreshed = await repo.getWithMessages(userId, conversation.id)
    expect(refreshed.conversation.lastActivityAt.getTime()).toBeGreaterThan(0)
  })

  it('replays prior messages to the model on a follow-up turn', async () => {
    const userId = await seedUser()
    const conversation = await repo.createConversation({ userId, mode: 'standalone' })

    await collect(
      service.runTurn({ userId, conversationId: conversation.id, content: 'First question' }),
    )
    await collect(
      service.runTurn({ userId, conversationId: conversation.id, content: 'Second question' }),
    )

    const messages = await repo.loadMessages(userId, conversation.id)
    const userContents = messages
      .filter((m) => m.role === 'user')
      .map((m) => JSON.stringify(m.content))
    expect(userContents.some((c) => c.includes('First question'))).toBe(true)
    expect(userContents.some((c) => c.includes('Second question'))).toBe(true)
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(2)
  })

  it('returns not-found for a conversation the user does not own', async () => {
    const ownerId = await seedUser()
    const conversation = await repo.createConversation({ userId: ownerId, mode: 'standalone' })
    const otherId = await seedUser()

    await expect(
      collect(
        service.runTurn({ userId: otherId, conversationId: conversation.id, content: 'hi' }),
      ),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('emits an SSE error event and throws when the stream errors', async () => {
    const userId = await seedUser()
    const conversation = await repo.createConversation({ userId, mode: 'standalone' })

    const events: SseEvent[] = []
    await expect(
      (async () => {
        for await (const event of service.runTurn({
          userId,
          conversationId: conversation.id,
          content: FAIL_MARKER,
        })) {
          events.push(event)
        }
      })(),
    ).rejects.toThrow()

    expect(events.some((e) => e.type === 'error')).toBe(true)
  })

  it('bridges a material-ingestion job completion onto the SSE channel', async () => {
    const worker = new Worker(
      AGENT_MATERIAL_QUEUE_NAME,
      async () => ({ done: true }),
      { connection: materialQueue.opts.connection },
    )
    await worker.waitUntilReady()
    try {
      const job = await materialQueue.add('ingest-on-demand', {
        certificationId: 'c',
        topic: 't',
        requestedByUserId: 'u',
        sessionId: 's',
      })
      const event = await service.waitForMaterialJob(String(job.id))
      expect(event.type).toBe('job-event')
      expect(event.jobId).toBe(String(job.id))
    } finally {
      await worker.close()
    }
  }, 30_000)
})
