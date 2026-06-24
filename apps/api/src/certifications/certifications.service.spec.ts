import { MikroORM } from '@mikro-orm/core'
import { NotFoundException } from '@nestjs/common'
import { Certification, CertificationSchema } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { startPostgresContainer } from '@readion/db/src/test-helpers/containers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { CertificationsService } from './certifications.service'

describe('CertificationsService', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>
  let service: CertificationsService

  beforeAll(async () => {
    container = await startPostgresContainer()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [CertificationSchema],
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: 'readion_test',
    })
    await orm.migrator.up()
    service = new CertificationsService(orm.em)
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  afterEach(async () => {
    await orm.em.getConnection().execute('TRUNCATE TABLE certifications')
  })

  function seedCert(
    overrides: Partial<{
      code: string
      name: string
      state: 'draft' | 'live'
    }> = {},
  ) {
    const em = orm.em.fork()
    const cert = em.create(Certification, {
      name: overrides.name ?? 'AWS Cloud Practitioner',
      provider: 'AWS',
      code: overrides.code ?? 'CLF-C02',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: overrides.state ?? 'live',
    })
    em.persist(cert)
    return em.flush().then(() => cert)
  }

  describe('list', () => {
    it('returns only live certifications', async () => {
      await seedCert({ code: 'LIVE-01', state: 'live' })
      await seedCert({ code: 'DRAFT-01', state: 'draft' })

      const result = await service.list()
      expect(result.items).toHaveLength(1)
      expect(result.items.at(0)?.code).toBe('LIVE-01')
      expect(result.meta.total).toBe(1)
    })

    it('returns empty list when no live certifications exist', async () => {
      await seedCert({ code: 'DRAFT-01', state: 'draft' })

      const result = await service.list()
      expect(result.items).toHaveLength(0)
      expect(result.meta.total).toBe(0)
    })

    it('paginates with default page size 25', async () => {
      const result = await service.list()
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(25)
    })

    it('respects page and limit options', async () => {
      for (let i = 1; i <= 3; i++) {
        await seedCert({ code: `CERT-0${i}`, name: `Cert ${i}`, state: 'live' })
      }

      const page1 = await service.list({ page: 1, limit: 2 })
      expect(page1.items).toHaveLength(2)
      expect(page1.meta.total).toBe(3)
      expect(page1.meta.page).toBe(1)
      expect(page1.meta.limit).toBe(2)

      const page2 = await service.list({ page: 2, limit: 2 })
      expect(page2.items).toHaveLength(1)
      expect(page2.meta.page).toBe(2)
    })

    it('caps limit at 100', async () => {
      const result = await service.list({ limit: 500 })
      expect(result.meta.limit).toBe(100)
    })
  })

  describe('findOne', () => {
    it('returns the certification by id', async () => {
      const cert = await seedCert({ code: 'CLF-C02', state: 'live' })

      const result = await service.findOne(cert.id)
      expect(result.id).toBe(cert.id)
      expect(result.code).toBe('CLF-C02')
      expect(result.provider).toBe('AWS')
    })

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException for a draft certification', async () => {
      const cert = await seedCert({ code: 'DRAFT-ONLY', state: 'draft' })
      await expect(service.findOne(cert.id)).rejects.toThrow(NotFoundException)
    })

    it('does not expose internal fields', async () => {
      const cert = await seedCert({ code: 'CLF-C02', state: 'live' })
      const result = await service.findOne(cert.id)

      expect(result).not.toHaveProperty('provenance')
      expect(result).not.toHaveProperty('verifiedAt')
      expect(result).not.toHaveProperty('passwordHash')
    })
  })
})
