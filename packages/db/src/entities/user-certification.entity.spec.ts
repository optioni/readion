import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { Certification, CertificationSchema } from './certification.entity'
import { User, UserSchema } from './user.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

describe('UserCertification entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [UserSchema, CertificationSchema, UserCertificationSchema],
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
      .execute('TRUNCATE TABLE user_certifications, certifications, users CASCADE')
  })

  function seedUser(em: ReturnType<typeof orm.em.fork>) {
    const user = em.create(User, {
      email: `user-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    em.persist(user)
    return user
  }

  function seedCert(em: ReturnType<typeof orm.em.fork>, code = 'CLF-C02') {
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
    return cert
  }

  it('persists with status defaulting to active and all overrides null', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const enrollment = em.create(UserCertification, {
      user,
      certification: cert,
    })
    em.persist(enrollment)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(
      UserCertification,
      { id: enrollment.id },
      { populate: ['user', 'certification'] },
    )

    expect(persisted.status).toBe('active')
    expect(persisted.enrolledAt).toBeInstanceOf(Date)
    expect(persisted.sessionOverrideDuration).toBeNull()
    expect(persisted.sessionOverrideContentMix).toBeNull()
    expect(persisted.sessionOverrideDifficulty).toBeNull()
    expect(persisted.sessionOverrideFocusArea).toBeNull()
    expect(persisted.sessionOverrideLearningStyle).toBeNull()
    expect(persisted.user.id).toBe(user.id)
    expect(persisted.certification.id).toBe(cert.id)
    expect(persisted.createdAt).toBeInstanceOf(Date)
    expect(persisted.updatedAt).toBeInstanceOf(Date)
  })

  it('persists with session override fields when supplied', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const enrollment = em.create(UserCertification, {
      user,
      certification: cert,
      sessionOverrideDuration: 60,
      sessionOverrideDifficulty: 'advanced',
    })
    em.persist(enrollment)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(UserCertification, { id: enrollment.id })
    expect(persisted.sessionOverrideDuration).toBe(60)
    expect(persisted.sessionOverrideDifficulty).toBe('advanced')
    expect(persisted.sessionOverrideContentMix).toBeNull()
  })

  it('rejects a duplicate (user, certification) pair', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const first = em.create(UserCertification, { user, certification: cert })
    em.persist(first)
    await em.flush()

    const em2 = orm.em.fork()
    const userRef = em2.getReference(User, user.id)
    const certRef = em2.getReference(Certification, cert.id)
    const duplicate = em2.create(UserCertification, {
      user: userRef,
      certification: certRef,
    })
    em2.persist(duplicate)
    await expect(em2.flush()).rejects.toThrow()
  })

  it('allows two different users to enroll in the same certification', async () => {
    const em = orm.em.fork()
    const user1 = seedUser(em)
    const user2 = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const e1 = em.create(UserCertification, { user: user1, certification: cert })
    const e2 = em.create(UserCertification, { user: user2, certification: cert })
    em.persist(e1)
    em.persist(e2)

    await expect(em.flush()).resolves.not.toThrow()
  })

  it('allows the same user to enroll in different certifications', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert1 = seedCert(em, 'CERT-A')
    const cert2 = seedCert(em, 'CERT-B')
    await em.flush()

    const e1 = em.create(UserCertification, { user, certification: cert1 })
    const e2 = em.create(UserCertification, { user, certification: cert2 })
    em.persist(e1)
    em.persist(e2)

    await expect(em.flush()).resolves.not.toThrow()
  })

  it('persists diagnosticRePromptedAt as null by default', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const enrollment = em.create(UserCertification, {
      user,
      certification: cert,
    })
    em.persist(enrollment)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(UserCertification, { id: enrollment.id })
    expect(persisted.diagnosticRePromptedAt).toBeNull()
  })

  it('persists a supplied diagnosticRePromptedAt timestamp', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const stamp = new Date('2026-06-01T10:00:00Z')
    const enrollment = em.create(UserCertification, {
      user,
      certification: cert,
      diagnosticRePromptedAt: stamp,
    })
    em.persist(enrollment)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(UserCertification, { id: enrollment.id })
    expect(persisted.diagnosticRePromptedAt).toBeInstanceOf(Date)
    expect(persisted.diagnosticRePromptedAt?.toISOString()).toBe(stamp.toISOString())
  })

  it('preserves enrolledAt when status is updated', async () => {
    const em = orm.em.fork()
    const user = seedUser(em)
    const cert = seedCert(em)
    await em.flush()

    const enrollment = em.create(UserCertification, { user, certification: cert })
    em.persist(enrollment)
    await em.flush()

    const originalEnrolledAt = enrollment.enrolledAt

    enrollment.status = 'archived'
    await em.flush()

    em.clear()
    const after = await em.findOneOrFail(UserCertification, { id: enrollment.id })
    expect(after.enrolledAt.toISOString()).toBe(originalEnrolledAt.toISOString())
    expect(after.status).toBe('archived')
  })
})
