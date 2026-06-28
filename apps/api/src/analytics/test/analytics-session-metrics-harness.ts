import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { SessionStatus } from '@readion/shared'
import type { StartedTestContainer } from 'testcontainers'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { AnalyticsModule } from '../analytics.module'
import { AnalyticsService } from '../analytics.service'

const DAY_MS = 86_400_000

type AgentSeed = 'none' | 'user-message' | 'empty-conversation' | 'assistant-only'

export type SessionMetricsExpectations = {
  activeUsers: number
  completionRate: number
  agentEngagement: number
  sessionsPerWeek: number
}

export type SessionMetricsHarness = {
  app: INestApplication
  moduleRef: TestingModule
  service: AnalyticsService
  expectations: SessionMetricsExpectations
  teardown: () => Promise<void>
}

export async function createSessionMetricsHarness(): Promise<SessionMetricsHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, AnalyticsModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const em = moduleRef.get(EntityManager)
  const service = moduleRef.get(AnalyticsService)

  await truncateDomainTables(em)
  const expectations = await seedPopulation(em)

  return {
    app,
    moduleRef,
    service,
    expectations,
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
  }
}

async function seedPopulation(em: EntityManager): Promise<SessionMetricsExpectations> {
  const fork = em.fork()
  const conn = fork.getConnection()

  const certification = fork.create(Certification, {
    name: 'Cert SESSION-METRICS',
    provider: 'AWS',
    code: 'SESSION-METRICS',
    domains: [{ name: 'Cloud Concepts', weight: 100 }],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(certification)
  await fork.flush()

  const makeUser = async (email: string) => {
    const user = fork.create(User, { email, passwordHash: 'seeded-hash', emailVerified: true })
    const enrollment = fork.create(UserCertification, { user, certification, status: 'active' })
    fork.persist(user)
    fork.persist(enrollment)
    await fork.flush()
    return { user, enrollment }
  }

  const u1 = await makeUser('sm-active-1@analytics.test')
  const u2 = await makeUser('sm-active-2@analytics.test')
  const u3 = await makeUser('sm-single@analytics.test')
  const u4 = await makeUser('sm-stale@analytics.test')

  const addSession = async (
    owner: { user: User; enrollment: UserCertification },
    status: SessionStatus,
    startedDaysAgo: number,
    endedDaysAgo: number | null,
    agent: AgentSeed,
  ) => {
    const startedAt = new Date(Date.now() - startedDaysAgo * DAY_MS)
    const endedAt = endedDaysAgo === null ? null : new Date(Date.now() - endedDaysAgo * DAY_MS)
    const session = fork.create(StudySession, {
      user: owner.user,
      userCertification: owner.enrollment,
      kind: 'study',
      status,
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: { mode: 'auto' },
      learningStyle: 'weak-area-focus',
      startedAt,
      endedAt,
    })
    fork.persist(session)
    await fork.flush()

    if (agent === 'none') {
      return
    }

    const convo = await conn.execute<{ id: string }[]>(
      `INSERT INTO agent_conversations (id, user_id, study_session_id, certification_id, mode, last_activity_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, ?, 'in_session', now(), now(), now())
       RETURNING id`,
      [owner.user.id, session.id, certification.id],
    )
    const conversationId = convo[0]!.id

    if (agent === 'user-message') {
      await insertMessage(conn, conversationId, 'user')
    }
    if (agent === 'assistant-only') {
      await insertMessage(conn, conversationId, 'assistant')
    }
  }

  // u1 — active: two completed sessions within the window. One carries a real user agent
  // message; the other a linked but empty conversation that must not count as engagement.
  await addSession(u1, 'completed', 2, 2, 'user-message')
  await addSession(u1, 'completed', 4, 4, 'empty-conversation')
  // An abandoned session inside the window: counts toward "started" but never "reached".
  await addSession(u1, 'abandoned', 1, null, 'none')

  // u2 — active: two completed sessions within the window, one with a user agent message.
  await addSession(u2, 'completed', 3, 3, 'user-message')
  await addSession(u2, 'completed', 5, 5, 'none')

  // u3 — not active: a single completed session, plus a linked assistant-only conversation
  // (no user message) that must not count as agent engagement.
  await addSession(u3, 'completed', 1, 1, 'assistant-only')

  // u4 — not active: two completed sessions but both ended outside the trailing window.
  await addSession(u4, 'completed', 20, 20, 'none')
  await addSession(u4, 'completed', 22, 22, 'none')

  fork.clear()

  return {
    activeUsers: 2,
    completionRate: 5 / 6,
    agentEngagement: 2 / 6,
    sessionsPerWeek: 1,
  }
}

async function insertMessage(
  conn: ReturnType<EntityManager['getConnection']>,
  conversationId: string,
  role: 'user' | 'assistant',
) {
  await conn.execute(
    `INSERT INTO agent_messages (id, conversation_id, role, content, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, ?::jsonb, now(), now())`,
    [conversationId, role, JSON.stringify({ text: 'seeded' })],
  )
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
  process.env.PUBLIC_API_URL = 'http://localhost:3001'
  process.env.INTERNAL_API_SECRET = 'test-internal-lifecycle-secret'
  process.env.DIGEST_SEND_WEEKDAY = '1'
  process.env.DIGEST_SEND_HOUR = '8'
  process.env.EXAM_READY_THRESHOLD = '75'
  process.env.NUDGE_ACTIVITY_LULL_DAYS = '7'
  process.env.NUDGE_FOLLOWUP_DELAY_DAYS = '3'
  process.env.NUDGE_MAX_FOLLOWUPS = '1'
}
