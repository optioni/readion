import type { EntitySchema } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { Certification, CertificationSchema } from './certification.entity'
import { QuizResponse, QuizResponseSchema } from './quiz-response.entity'
import { User, UserSchema } from './user.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

const FIXTURE_PROVENANCE = {
  sourceChunkIds: ['chunk-1'],
  supportingSpans: ['EC2 provides scalable computing'],
  verdict: { pass: true, score: 0.95, distractorFindings: [] },
  score: 0.95,
}

const FIXTURE_SNAPSHOT = {
  question: 'What does EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  provenance: FIXTURE_PROVENANCE,
}

describe('QuizResponse entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [
        UserSchema,
        CertificationSchema,
        UserCertificationSchema,
        QuizResponseSchema,
      ] as EntitySchema[],
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  beforeEach(async () => {
    await orm.em
      .getConnection()
      .execute('TRUNCATE TABLE quiz_responses, user_certifications, certifications, users CASCADE')
  })

  async function seedUser(email = 'user@example.com') {
    const em = orm.em.fork()
    const user = em.create(User, {
      email,
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    em.persist(user)
    await em.flush()
    return user
  }

  async function seedCertification(code = 'CLF-C02') {
    const em = orm.em.fork()
    const cert = em.create(Certification, {
      name: 'AWS Cloud Practitioner',
      provider: 'AWS',
      code,
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
    })
    em.persist(cert)
    await em.flush()
    return cert
  }

  async function seedEnrollment(userId: string, certId: string) {
    const em = orm.em.fork()
    const enrollment = em.create(UserCertification, {
      user: em.getReference(User, userId),
      certification: em.getReference(Certification, certId),
    })
    em.persist(enrollment)
    await em.flush()
    return enrollment
  }

  it('persists a QuizResponse with all required fields', async () => {
    const user = await seedUser()
    const cert = await seedCertification()
    const enrollment = await seedEnrollment(user.id, cert.id)

    const em = orm.em.fork()
    const response = em.create(QuizResponse, {
      userCertification: em.getReference(UserCertification, enrollment.id),
      answer: 'Scalable computing capacity',
      correct: true,
      confidence: 4,
      timeTakenMs: 12000,
      questionSnapshot: FIXTURE_SNAPSHOT,
      format: 'multiple_choice',
    })
    em.persist(response)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(
      QuizResponse,
      { id: response.id },
      { populate: ['userCertification'] },
    )

    expect(persisted.answer).toBe('Scalable computing capacity')
    expect(persisted.correct).toBe(true)
    expect(persisted.confidence).toBe(4)
    expect(persisted.timeTakenMs).toBe(12000)
    expect(persisted.format).toBe('multiple_choice')
    expect(persisted.questionSnapshot.question).toBe(FIXTURE_SNAPSHOT.question)
    expect(persisted.questionSnapshot.correctAnswer).toBe(FIXTURE_SNAPSHOT.correctAnswer)
    expect(persisted.questionSnapshot.provenance.sourceChunkIds).toEqual(['chunk-1'])
    expect(persisted.userCertification.id).toBe(enrollment.id)
    expect(persisted.createdAt).toBeInstanceOf(Date)
    expect(persisted.updatedAt).toBeInstanceOf(Date)
  })

  it('persists an incorrect answer', async () => {
    const user = await seedUser()
    const cert = await seedCertification()
    const enrollment = await seedEnrollment(user.id, cert.id)

    const em = orm.em.fork()
    const response = em.create(QuizResponse, {
      userCertification: em.getReference(UserCertification, enrollment.id),
      answer: 'Object storage',
      correct: false,
      confidence: 2,
      timeTakenMs: 5000,
      questionSnapshot: FIXTURE_SNAPSHOT,
      format: 'true_false',
    })
    em.persist(response)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(QuizResponse, { id: response.id })
    expect(persisted.correct).toBe(false)
    expect(persisted.confidence).toBe(2)
  })

  it('has no SessionItem reference (scoped to enrollment only)', async () => {
    const user = await seedUser()
    const cert = await seedCertification()
    const enrollment = await seedEnrollment(user.id, cert.id)

    const em = orm.em.fork()
    const response = em.create(QuizResponse, {
      userCertification: em.getReference(UserCertification, enrollment.id),
      answer: 'A',
      correct: true,
      confidence: 3,
      timeTakenMs: 1000,
      questionSnapshot: FIXTURE_SNAPSHOT,
      format: 'multiple_choice',
    })
    em.persist(response)
    await em.flush()
    em.clear()

    const conn = em.getConnection()
    const rows = await conn.execute<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quiz_responses'
    `)
    const columnNames = rows.map((r: { column_name: string }) => r.column_name)
    expect(columnNames).not.toContain('session_item_id')
  })

  it('allows multiple QuizResponses per enrollment', async () => {
    const user = await seedUser()
    const cert = await seedCertification()
    const enrollment = await seedEnrollment(user.id, cert.id)

    const em = orm.em.fork()
    const r1 = em.create(QuizResponse, {
      userCertification: em.getReference(UserCertification, enrollment.id),
      answer: 'A',
      correct: true,
      confidence: 4,
      timeTakenMs: 2000,
      questionSnapshot: FIXTURE_SNAPSHOT,
      format: 'multiple_choice',
    })
    const r2 = em.create(QuizResponse, {
      userCertification: em.getReference(UserCertification, enrollment.id),
      answer: 'B',
      correct: false,
      confidence: 2,
      timeTakenMs: 3000,
      questionSnapshot: FIXTURE_SNAPSHOT,
      format: 'true_false',
    })
    em.persist(r1)
    em.persist(r2)
    await em.flush()

    const count = await em.count(QuizResponse, { userCertification: enrollment.id })
    expect(count).toBe(2)
  })
})
