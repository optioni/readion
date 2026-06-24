import { MikroORM } from '@mikro-orm/core'
import { ConflictException, NotFoundException } from '@nestjs/common'
import {
  Certification,
  CertificationSchema,
  User,
  UserCertification,
  UserCertificationSchema,
  UserSchema,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { startPostgresContainer } from '@readion/db/src/test-helpers/containers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { UserCertificationsService } from './user-certifications.service'

describe('UserCertificationsService', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>
  let service: UserCertificationsService

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
    service = new UserCertificationsService(orm.em)
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

  async function seedCert(code = 'CLF-C02', state: 'live' | 'draft' = 'live') {
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
      state,
    })
    em.persist(cert)
    await em.flush()
    return cert
  }

  describe('enroll', () => {
    it('creates an active enrollment for a live certification', async () => {
      const user = await seedUser()
      const cert = await seedCert('CLF-C02', 'live')

      const result = await service.enroll(user.id, cert.id)

      expect(result.certificationId).toBe(cert.id)
      expect(result.status).toBe('active')
      expect(result.enrolledAt).toBeDefined()
      expect(result.sessionDefaults.duration).toBeNull()

      const em = orm.em.fork()
      const row = await em.findOneOrFail(UserCertification, {
        user: user.id,
        certification: cert.id,
      })
      expect(row.status).toBe('active')
    })

    it('stores session default overrides when supplied', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const result = await service.enroll(user.id, cert.id, {
        duration: 60,
        difficulty: 'advanced',
      })

      expect(result.sessionDefaults.duration).toBe(60)
      expect(result.sessionDefaults.difficulty).toBe('advanced')
      expect(result.sessionDefaults.contentMix).toBeNull()
    })

    it('throws NotFoundException for a draft certification', async () => {
      const user = await seedUser()
      const cert = await seedCert('DRAFT-01', 'draft')

      await expect(service.enroll(user.id, cert.id)).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException for a non-existent certification', async () => {
      const user = await seedUser()

      await expect(service.enroll(user.id, '00000000-0000-4000-8000-000000000000')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('restores an archived enrollment preserving enrolledAt', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const original = await service.enroll(user.id, cert.id)
      const originalEnrolledAt = original.enrolledAt

      await service.archive(user.id, original.id)

      const restored = await service.enroll(user.id, cert.id)

      expect(restored.id).toBe(original.id)
      expect(restored.status).toBe('active')
      expect(restored.enrolledAt).toBe(originalEnrolledAt)

      const em = orm.em.fork()
      const rows = await em.find(UserCertification, { user: user.id, certification: cert.id })
      expect(rows).toHaveLength(1)
    })

    it('throws ConflictException when already actively enrolled', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      await service.enroll(user.id, cert.id)

      await expect(service.enroll(user.id, cert.id)).rejects.toThrow(ConflictException)
    })
  })

  describe('list', () => {
    it('returns only active enrollments by default', async () => {
      const user = await seedUser()
      const cert1 = await seedCert('CERT-A')
      const cert2 = await seedCert('CERT-B')

      const e1 = await service.enroll(user.id, cert1.id)
      await service.enroll(user.id, cert2.id)
      await service.archive(user.id, e1.id)

      const result = await service.list(user.id)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].certificationId).toBe(cert2.id)
    })

    it('returns archived enrollments when status filter is archived', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      await service.archive(user.id, enrollment.id)

      const result = await service.list(user.id, 'archived')

      expect(result.items).toHaveLength(1)
      expect(result.items[0].status).toBe('archived')
    })

    it("does not include another user's enrollments", async () => {
      const user1 = await seedUser('user1@example.com')
      const user2 = await seedUser('user2@example.com')
      const cert = await seedCert()

      await service.enroll(user1.id, cert.id)
      await service.enroll(user2.id, cert.id)

      const result = await service.list(user1.id)

      expect(result.items).toHaveLength(1)
      expect(result.items.every((item) => item.certificationId === cert.id)).toBe(true)
    })

    it('returns empty list with zero total when no enrollments', async () => {
      const user = await seedUser()

      const result = await service.list(user.id)

      expect(result.items).toHaveLength(0)
      expect(result.meta.total).toBe(0)
    })
  })

  describe('findOne', () => {
    it('returns the enrollment for the owning user', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      const result = await service.findOne(user.id, enrollment.id)

      expect(result.id).toBe(enrollment.id)
      expect(result.certificationId).toBe(cert.id)
    })

    it('throws NotFoundException when enrollment belongs to another user', async () => {
      const user1 = await seedUser('u1@example.com')
      const user2 = await seedUser('u2@example.com')
      const cert = await seedCert()

      const enrollment = await service.enroll(user1.id, cert.id)

      await expect(service.findOne(user2.id, enrollment.id)).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException for a non-existent id', async () => {
      const user = await seedUser()

      await expect(
        service.findOne(user.id, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateOverrides', () => {
    it('updates a single override field', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      const result = await service.updateOverrides(user.id, enrollment.id, {
        sessionDefaults: { learningStyle: 'spaced-repetition' },
      })

      expect(result.sessionDefaults.learningStyle).toBe('spaced-repetition')
      expect(result.sessionDefaults.duration).toBeNull()
    })

    it('clears an override by setting it to null', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id, { duration: 60 })
      const result = await service.updateOverrides(user.id, enrollment.id, {
        sessionDefaults: { duration: null },
      })

      expect(result.sessionDefaults.duration).toBeNull()
    })

    it('updates contentMix, difficulty and focusArea overrides', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      const result = await service.updateOverrides(user.id, enrollment.id, {
        sessionDefaults: { contentMix: 'quiz-heavy', difficulty: 'advanced', focusArea: 'weak-areas' },
      })

      expect(result.sessionDefaults.contentMix).toBe('quiz-heavy')
      expect(result.sessionDefaults.difficulty).toBe('advanced')
      expect(result.sessionDefaults.focusArea).toBe('weak-areas')
    })

    it("throws NotFoundException for another user's enrollment", async () => {
      const user1 = await seedUser('ua@example.com')
      const user2 = await seedUser('ub@example.com')
      const cert = await seedCert()

      const enrollment = await service.enroll(user1.id, cert.id)

      await expect(
        service.updateOverrides(user2.id, enrollment.id, { sessionDefaults: { duration: 30 } }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('archive', () => {
    it('sets status to archived without deleting', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      const result = await service.archive(user.id, enrollment.id)

      expect(result.status).toBe('archived')

      const em = orm.em.fork()
      const row = await em.findOneOrFail(UserCertification, { id: enrollment.id })
      expect(row.status).toBe('archived')
    })

    it("throws NotFoundException for another user's enrollment", async () => {
      const user1 = await seedUser('ua@example.com')
      const user2 = await seedUser('ub@example.com')
      const cert = await seedCert()

      const enrollment = await service.enroll(user1.id, cert.id)

      await expect(service.archive(user2.id, enrollment.id)).rejects.toThrow(NotFoundException)
    })
  })

  describe('restore', () => {
    it('sets status back to active', async () => {
      const user = await seedUser()
      const cert = await seedCert()

      const enrollment = await service.enroll(user.id, cert.id)
      await service.archive(user.id, enrollment.id)
      const result = await service.restore(user.id, enrollment.id)

      expect(result.status).toBe('active')
    })

    it("throws NotFoundException for another user's enrollment", async () => {
      const user1 = await seedUser('ua@example.com')
      const user2 = await seedUser('ub@example.com')
      const cert = await seedCert()

      const enrollment = await service.enroll(user1.id, cert.id)
      await service.archive(user1.id, enrollment.id)

      await expect(service.restore(user2.id, enrollment.id)).rejects.toThrow(NotFoundException)
    })
  })
})
