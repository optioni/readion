import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import {
  Certification,
  ContentChunk,
  ContentSource,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { ExamOutcomeResponse, PassRateBreakdown, QuestionFormat } from '@readion/shared'
import { AppModule } from '../../app.module'
import { bootstrapApp } from '../../bootstrap'
import { ReadinessService } from '../../readiness/readiness.service'
import { AnalyticsModule } from '../analytics.module'
import { AnalyticsService } from '../analytics.service'
import { configureAnalyticsTestEnv, truncateDomainTables } from './analytics-test-env'

const DOMAIN = 'Cloud Concepts'

export type PassRateExpectations = {
  // A mix of recorded outcomes plus enrollments with NO outcome (null) that must not be counted.
  // `dismissed` is deliberately absent from the seed so the breakdown must zero-fill it.
  breakdown: PassRateBreakdown
  // A calibrated enrollment (graded quiz responses) used to prove that recording an exam outcome
  // never alters the readiness score.
  calibratedEnrollmentId: string
}

export type PassRateHarness = {
  app: INestApplication
  moduleRef: TestingModule
  service: AnalyticsService
  readiness: ReadinessService
  em: EntityManager
  expectations: PassRateExpectations
  teardown: () => Promise<void>
}

export async function createPassRateHarness(): Promise<PassRateHarness> {
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
  const readiness = moduleRef.get(ReadinessService)

  await truncateDomainTables(em)
  const expectations = await seedPopulation(em)

  return {
    app,
    moduleRef,
    service,
    readiness,
    em,
    expectations,
    teardown: async () => {
      await app.close()
      await postgresContainer.stop()
      await redisContainer.stop()
    },
  }
}

async function seedPopulation(em: EntityManager): Promise<PassRateExpectations> {
  const fork = em.fork()
  const conn = fork.getConnection()

  const certification = fork.create(Certification, {
    name: 'Cert PASSRATE',
    provider: 'AWS',
    code: 'PASSRATE',
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
    url: 'https://seed.test/passrate',
    recheckIntervalMinutes: 1440,
  })
  fork.persist(contentSource)
  await fork.flush()

  const chunk = fork.create(ContentChunk, {
    contentSourceId: contentSource.id,
    certificationId: certification.id,
    text: 'seeded chunk',
    contentHash: 'b'.repeat(64),
    domainTags: [{ domain: DOMAIN, confidence: 1 }],
    primaryDomain: DOMAIN,
  })
  fork.persist(chunk)
  await fork.flush()

  let userCounter = 0
  const makeEnrollment = async (outcome: ExamOutcomeResponse | null) => {
    userCounter += 1
    const user = fork.create(User, {
      email: `pass-rate-${userCounter}@analytics.test`,
      passwordHash: 'seeded-hash',
      emailVerified: true,
    })
    const enrollment = fork.create(UserCertification, { user, certification, status: 'active' })
    enrollment.examOutcomeResponse = outcome
    enrollment.examOutcomeRespondedAt = outcome === null ? null : new Date()
    fork.persist(user)
    fork.persist(enrollment)
    await fork.flush()
    return enrollment
  }

  // 2 passed, 1 did_not_pass, 1 not_yet, 0 dismissed, plus 2 with no outcome recorded.
  await makeEnrollment('passed')
  await makeEnrollment('passed')
  await makeEnrollment('did_not_pass')
  await makeEnrollment('not_yet')
  await makeEnrollment(null)
  const calibrated = await makeEnrollment(null)

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
  const at = new Date().toISOString()
  for (let i = 0; i < 12; i++) {
    await conn.execute(
      `INSERT INTO quiz_responses
        (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
      [calibrated.id, 'A', true, 5, 1000, snapshot, format, at, at],
    )
  }

  const calibratedEnrollmentId = calibrated.id
  fork.clear()

  return {
    breakdown: { passed: 2, did_not_pass: 1, not_yet: 1, dismissed: 0 },
    calibratedEnrollmentId,
  }
}
