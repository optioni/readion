import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  MockExam,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { SessionStatus } from '@readion/shared'
import type Redis from 'ioredis'
import supertest from 'supertest'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { REDIS_CLIENT } from '../../redis/redis.module'
import { configureAnalyticsTestEnv, truncateDomainTables } from './analytics-test-env'

const DAY_MS = 86_400_000

// Numbers the GREEN groups must reproduce from the seeded population. Exposed so the
// acceptance spec can assert that the analytics figures actually reflect what we seeded.
export type SeededPopulation = {
  expectedActiveUsers: number
  expectedCompletedSessions: number
  expectedAbandonedSessions: number
  expectedSessionsWithAgent: number
  expectedExamOutcomeResponses: number
}

export type AnalyticsAcceptanceHarness = {
  app: INestApplication
  moduleRef: TestingModule
  teardown: () => Promise<void>
  getRequest: () => ReturnType<typeof supertest>
  adminToken: string
  userToken: string
  population: SeededPopulation
}

export async function createAnalyticsAcceptanceHarness(): Promise<AnalyticsAcceptanceHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureAnalyticsTestEnv(postgresContainer, redisContainer)

  await acquireIsolatedDatabase()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await bootstrapApp(app)
  await app.init()

  const redis = moduleRef.get<Redis>(REDIS_CLIENT)
  const em = moduleRef.get(EntityManager)
  const httpServer = app.getHttpServer()
  const request = () => supertest(httpServer)

  await redis.flushdb()
  await truncateDomainTables(em)

  const register = async (email: string, password: string) => {
    const res = await request().post('/api/v1/auth/register').send({ email, password })
    return res.body.data.accessToken as string
  }

  const adminToken = await register('admin@analytics.test', 'correcthorse')
  const userToken = await register('viewer@analytics.test', 'correcthorse')

  const population = await seedPopulation(em)

  return {
    app,
    moduleRef,
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
    getRequest: request,
    adminToken,
    userToken,
    population,
  }
}

async function seedPopulation(em: EntityManager): Promise<SeededPopulation> {
  const fork = em.fork()
  const conn = fork.getConnection()

  await conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", ['admin@analytics.test'])

  const certification = fork.create(Certification, {
    name: 'Cert ANALYTICS',
    provider: 'AWS',
    code: 'ANALYTICS-CERT',
    domains: [
      { name: 'Cloud Concepts', weight: 50 },
      { name: 'Security', weight: 50 },
    ],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(certification)
  await fork.flush()

  const makeUser = (email: string, createdDaysAgo: number) => {
    const user = fork.create(User, {
      email,
      passwordHash: 'seeded-hash',
      emailVerified: true,
    })
    fork.persist(user)
    return { user, createdDaysAgo }
  }

  // Three active users (each will get >=2 completed sessions ended within the trailing
  // 14 days) plus two inactive users so the active-user metric has a non-trivial answer.
  const activeUsers = [
    makeUser('active-1@analytics.test', 30),
    makeUser('active-2@analytics.test', 21),
    makeUser('active-3@analytics.test', 14),
  ]
  const inactiveUsers = [
    makeUser('inactive-1@analytics.test', 40),
    makeUser('inactive-2@analytics.test', 60),
  ]
  await fork.flush()

  for (const { user, createdDaysAgo } of [...activeUsers, ...inactiveUsers]) {
    await conn.execute(
      "UPDATE users SET created_at = now() - (? * interval '1 day') WHERE id = ?",
      [createdDaysAgo, user.id],
    )
  }

  const enrollments = new Map<string, string>()
  for (const { user } of [...activeUsers, ...inactiveUsers]) {
    const enrollment = fork.create(UserCertification, {
      user,
      certification,
      status: 'active',
    })
    fork.persist(enrollment)
    enrollments.set(user.id, enrollment.id)
  }
  await fork.flush()

  let expectedCompletedSessions = 0
  let expectedAbandonedSessions = 0
  let expectedSessionsWithAgent = 0

  const addSession = async (
    userId: string,
    status: SessionStatus,
    endedDaysAgo: number | null,
    withAgent: boolean,
  ) => {
    const enrollmentId = enrollments.get(userId)!
    const enrollment = await fork.findOneOrFail(UserCertification, { id: enrollmentId })
    const user = await fork.findOneOrFail(User, { id: userId })
    const endedAt = endedDaysAgo === null ? null : new Date(Date.now() - endedDaysAgo * DAY_MS)
    const startedAt = new Date(Date.now() - ((endedDaysAgo ?? 0) * DAY_MS + 30 * 60_000))
    const session = fork.create(StudySession, {
      user,
      userCertification: enrollment,
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

    if (status === 'completed' || status === 'partial') {
      expectedCompletedSessions += 1
    }
    if (status === 'abandoned') {
      expectedAbandonedSessions += 1
    }

    if (withAgent) {
      expectedSessionsWithAgent += 1
      const convoResult = await conn.execute<{ id: string }[]>(
        `INSERT INTO agent_conversations (id, user_id, study_session_id, certification_id, mode, last_activity_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, 'in_session', now(), now(), now())
         RETURNING id`,
        [userId, session.id, certification.id],
      )
      const conversationId = convoResult[0]!.id
      await conn.execute(
        `INSERT INTO agent_messages (id, conversation_id, role, content, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'user', ?::jsonb, now(), now())`,
        [conversationId, JSON.stringify({ text: 'Can you explain this domain?' })],
      )
    }
  }

  // Active users: two completed sessions each within the trailing 14 days; one of each
  // pair carries an agent interaction so agent-engagement has signal.
  for (const [index, { user }] of activeUsers.entries()) {
    await addSession(user.id, 'completed', 2 + index, true)
    await addSession(user.id, 'completed', 5 + index, false)
  }

  // Inactive-1: only a single completed session -> below the "active" threshold.
  await addSession(inactiveUsers[0]!.user.id, 'completed', 3, false)
  // Inactive-2: two completed sessions but both ended outside the 14-day window.
  await addSession(inactiveUsers[1]!.user.id, 'completed', 20, false)
  await addSession(inactiveUsers[1]!.user.id, 'partial', 25, false)

  // A couple of abandoned sessions that must never count as completed/active.
  await addSession(activeUsers[0]!.user.id, 'abandoned', null, false)
  await addSession(inactiveUsers[0]!.user.id, 'abandoned', null, false)

  // Graded quiz responses spread across the trailing 28-day window.
  for (const { user } of [...activeUsers, ...inactiveUsers]) {
    const enrollmentId = enrollments.get(user.id)!
    for (let day = 0; day < 28; day += 4) {
      const correct = day % 8 === 0
      await conn.execute(
        `INSERT INTO quiz_responses (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'A', ?, 3, 5000, ?::jsonb, 'multiple_choice', now() - (? * interval '1 day'), now() - (? * interval '1 day'))`,
        [
          enrollmentId,
          correct,
          JSON.stringify({
            question: 'Q?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            provenance: { sourceChunkIds: [], supportingSpans: [], score: 0.9 },
          }),
          day,
          day,
        ],
      )
    }
  }

  // At least one submitted mock exam (recent) plus an earlier diagnostic so a readiness
  // gain delta exists for the north-star metric.
  const firstActive = activeUsers[0]!
  const firstEnrollmentId = enrollments.get(firstActive.user.id)!
  await conn.execute(
    `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, score, passed, domain_breakdown, questions, created_at, updated_at)
     VALUES
       (gen_random_uuid(), ?, ?, 'diagnostic', 'submitted', 55, false, '{}'::jsonb, '[]'::jsonb, now() - (24 * interval '1 day'), now() - (24 * interval '1 day')),
       (gen_random_uuid(), ?, ?, 'mock', 'submitted', 80, true, '{}'::jsonb, '[]'::jsonb, now() - (2 * interval '1 day'), now() - (2 * interval '1 day'))`,
    [firstActive.user.id, firstEnrollmentId, firstActive.user.id, firstEnrollmentId],
  )

  // Recorded exam-outcome responses feeding the lagging pass-rate breakdown.
  await conn.execute(
    "UPDATE user_certifications SET exam_outcome_response = 'passed', exam_outcome_responded_at = now() WHERE id = ?",
    [enrollments.get(activeUsers[0]!.user.id)!],
  )
  await conn.execute(
    "UPDATE user_certifications SET exam_outcome_response = 'did_not_pass', exam_outcome_responded_at = now() WHERE id = ?",
    [enrollments.get(activeUsers[1]!.user.id)!],
  )

  fork.clear()

  return {
    expectedActiveUsers: activeUsers.length,
    expectedCompletedSessions,
    expectedAbandonedSessions,
    expectedSessionsWithAgent,
    expectedExamOutcomeResponses: 2,
  }
}
