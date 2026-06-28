import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  ContentChunk,
  ContentSource,
  StudySession,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { QuestionFormat, SessionStatus } from '@readion/shared'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { AnalyticsModule } from '../analytics.module'
import { AnalyticsService } from '../analytics.service'
import { configureAnalyticsTestEnv, truncateDomainTables } from './analytics-test-env'

const DAY_MS = 86_400_000
const DOMAIN = 'Cloud Concepts'

export type NorthstarExpectations = {
  // Only the "improved" user is calibrated at the 28-day window start; the other active user
  // is uncalibrated at T and must be excluded from the median (not folded in as a zero).
  readinessGain: number
}

export type NorthstarHarness = {
  app: INestApplication
  moduleRef: TestingModule
  service: AnalyticsService
  expectations: NorthstarExpectations
  teardown: () => Promise<void>
}

export async function createNorthstarHarness(): Promise<NorthstarHarness> {
  const [postgresContainer, redisContainer] = await Promise.all([
    startPostgresContainer(),
    startRedisContainer(),
  ])

  configureAnalyticsTestEnv(postgresContainer, redisContainer)

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

async function seedPopulation(em: EntityManager): Promise<NorthstarExpectations> {
  const fork = em.fork()
  const conn = fork.getConnection()
  const now = Date.now()

  const certification = fork.create(Certification, {
    name: 'Cert NORTHSTAR',
    provider: 'AWS',
    code: 'NORTHSTAR',
    domains: [{ name: DOMAIN, weight: 100 }],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(certification)
  await fork.flush()

  const contentSource = fork.create(ContentSource, {
    certificationId: certification.id,
    type: 'web',
    url: 'https://seed.test/northstar',
    recheckIntervalMinutes: 1440,
  })
  fork.persist(contentSource)
  await fork.flush()

  const chunk = fork.create(ContentChunk, {
    contentSourceId: contentSource.id,
    certificationId: certification.id,
    text: 'seeded chunk',
    contentHash: 'a'.repeat(64),
    domainTags: [{ domain: DOMAIN, confidence: 1 }],
    primaryDomain: DOMAIN,
  })
  fork.persist(chunk)
  await fork.flush()

  const makeUser = async (email: string) => {
    const user = fork.create(User, { email, passwordHash: 'seeded-hash', emailVerified: true })
    const enrollment = fork.create(UserCertification, { user, certification, status: 'active' })
    fork.persist(user)
    fork.persist(enrollment)
    await fork.flush()
    return { user, enrollment }
  }

  const improved = await makeUser('ns-improved@analytics.test')
  const uncalibrated = await makeUser('ns-uncalibrated@analytics.test')

  const addSession = async (
    owner: { user: User; enrollment: UserCertification },
    status: SessionStatus,
    daysAgo: number,
  ) => {
    const at = new Date(now - daysAgo * DAY_MS)
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
      startedAt: at,
      endedAt: at,
    })
    fork.persist(session)
    await fork.flush()
  }

  const addResponses = async (
    enrollment: UserCertification,
    count: number,
    correct: boolean,
    daysAgo: number,
  ) => {
    const at = new Date(now - daysAgo * DAY_MS).toISOString()
    const snapshot = JSON.stringify({
      question: 'Q',
      options: ['A', 'B'],
      correctAnswer: 'A',
      provenance: {
        sourceChunkIds: [chunk.id],
        supportingSpans: [],
        verdict: { pass: true, score: 1, distractorFindings: [] },
        score: 1,
      },
    })
    const format: QuestionFormat = 'multiple_choice'
    for (let i = 0; i < count; i++) {
      await conn.execute(
        `INSERT INTO quiz_responses
          (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
        [enrollment.id, correct ? 'A' : 'B', correct, 5, 1000, snapshot, format, at, at],
      )
    }
  }

  // Both users are active: two completed sessions ended inside the 14-day active window.
  await addSession(improved, 'completed', 2)
  await addSession(improved, 'completed', 4)
  await addSession(uncalibrated, 'completed', 3)
  await addSession(uncalibrated, 'completed', 5)

  // Improved user: calibrated at the window start (10 graded answers existed at T, all wrong →
  // readiness ~0 at T) then 20 correct answers land inside the window → readiness ~67 now.
  await addResponses(improved.enrollment, 10, false, 28)
  await addResponses(improved.enrollment, 20, true, 1)

  // Uncalibrated-at-T user: every answer postdates the window start, so there is no calibrated
  // readiness at T and this enrollment is excluded from the median entirely.
  await addResponses(uncalibrated.enrollment, 15, true, 2)

  fork.clear()

  return { readinessGain: 67 }
}
