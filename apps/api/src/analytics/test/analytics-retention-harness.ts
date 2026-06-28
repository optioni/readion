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
import type { RetentionCohort, SessionStatus } from '@readion/shared'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { AnalyticsModule } from '../analytics.module'
import { AnalyticsService } from '../analytics.service'
import { configureAnalyticsTestEnv, truncateDomainTables } from './analytics-test-env'

const DOMAIN = 'Cloud Concepts'

// Fixed reporting instant: both seeded cohorts have their W4 boundary (registration + 28d) at or
// before this instant, so every figure below is fully matured and deterministic.
export const RETENTION_NOW = new Date('2026-06-29T00:00:00.000Z')

export type RetentionExpectations = {
  w2Cohorts: RetentionCohort[]
  w4Cohorts: RetentionCohort[]
  w2Value: number
  w2Population: number
  w4Value: number
  w4Population: number
}

export type RetentionHarness = {
  app: INestApplication
  moduleRef: TestingModule
  service: AnalyticsService
  expectations: RetentionExpectations
  teardown: () => Promise<void>
}

export async function createRetentionHarness(): Promise<RetentionHarness> {
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

async function seedPopulation(em: EntityManager): Promise<RetentionExpectations> {
  const fork = em.fork()
  const conn = fork.getConnection()

  const certification = fork.create(Certification, {
    name: 'Cert RETENTION',
    provider: 'AWS',
    code: 'RETENTION',
    domains: [{ name: DOMAIN, weight: 100 }],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(certification)
  await fork.flush()

  const makeUser = async (email: string, registeredOn: string) => {
    const user = fork.create(User, { email, passwordHash: 'seeded-hash', emailVerified: true })
    const enrollment = fork.create(UserCertification, { user, certification, status: 'active' })
    fork.persist(user)
    fork.persist(enrollment)
    await fork.flush()
    await conn.execute('UPDATE users SET created_at = ? WHERE id = ?', [
      new Date(`${registeredOn}T00:00:00.000Z`),
      user.id,
    ])
    return { user, enrollment }
  }

  const addSessions = async (
    owner: { user: User; enrollment: UserCertification },
    days: string[],
    status: SessionStatus = 'completed',
  ) => {
    for (const day of days) {
      const at = new Date(`${day}T00:00:00.000Z`)
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
    }
    await fork.flush()
  }

  // Cohort 2026-06-01: W2 boundary 06-15 (window 06-01..06-15), W4 boundary 06-29 (06-15..06-29).
  const u1 = await makeUser('r-u1@analytics.test', '2026-06-01')
  const u2 = await makeUser('r-u2@analytics.test', '2026-06-01')
  const u3 = await makeUser('r-u3@analytics.test', '2026-06-01')
  // Active in W2 and W4.
  await addSessions(u1, ['2026-06-10', '2026-06-14', '2026-06-20', '2026-06-28'])
  // Active in W2 only.
  await addSessions(u2, ['2026-06-10', '2026-06-14'])
  // Never active (one completed session is below the min-sessions threshold).
  await addSessions(u3, ['2026-06-10'])

  // Cohort 2026-05-04: W2 boundary 05-18 (05-04..05-18), W4 boundary 06-01 (05-18..06-01).
  const u4 = await makeUser('r-u4@analytics.test', '2026-05-04')
  await addSessions(u4, ['2026-05-10', '2026-05-16', '2026-05-25', '2026-05-30'])

  fork.clear()

  return {
    w2Cohorts: [
      { cohortWeek: '2026-05-04', size: 1, retained: 1, fraction: 1 },
      { cohortWeek: '2026-06-01', size: 3, retained: 2, fraction: 2 / 3 },
    ],
    w4Cohorts: [
      { cohortWeek: '2026-05-04', size: 1, retained: 1, fraction: 1 },
      { cohortWeek: '2026-06-01', size: 3, retained: 1, fraction: 1 / 3 },
    ],
    w2Value: 3 / 4,
    w2Population: 4,
    w4Value: 2 / 4,
    w4Population: 4,
  }
}
