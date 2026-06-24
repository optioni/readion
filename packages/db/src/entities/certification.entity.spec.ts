import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { Certification, CertificationSchema } from './certification.entity'

describe('Certification entity', () => {
  let orm: MikroORM
  let container: Awaited<ReturnType<typeof startPostgresContainer>>

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
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  it('persists all structured fields and defaults state to draft', async () => {
    const em = orm.em.fork()

    const cert = em.create(Certification, {
      name: 'AWS Cloud Practitioner',
      provider: 'AWS',
      code: 'CLF-TEST-01',
      domains: [
        { name: 'Cloud Concepts', weight: 24 },
        { name: 'Security and Compliance', weight: 30 },
        { name: 'Cloud Technology and Services', weight: 34 },
        { name: 'Billing, Pricing, and Support', weight: 12 },
      ],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      verifiedAt: new Date('2026-06-24T00:00:00.000Z'),
    })

    em.persist(cert)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(Certification, { id: cert.id })

    expect(persisted.name).toBe('AWS Cloud Practitioner')
    expect(persisted.provider).toBe('AWS')
    expect(persisted.code).toBe('CLF-TEST-01')
    expect(persisted.state).toBe('draft')
    expect(persisted.provenance).toBe('verified')
    expect(persisted.verifiedAt).toBeInstanceOf(Date)
    expect(persisted.questionCount).toBe(65)
    expect(persisted.passingScore).toBe(700)
    expect(persisted.timeLimitMinutes).toBe(90)
    expect(persisted.domains).toHaveLength(4)
    expect(persisted.domains[0]).toEqual({ name: 'Cloud Concepts', weight: 24 })

    const weightSum = persisted.domains.reduce((sum, d) => sum + d.weight, 0)
    expect(weightSum).toBe(100)
  })

  it('enforces unique code constraint', async () => {
    const em = orm.em.fork()

    const first = em.create(Certification, {
      name: 'Test Cert Unique',
      provider: 'Test',
      code: 'TEST-UNIQUE-001',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 45,
      passingScore: 700,
      timeLimitMinutes: 45,
      provenance: 'verified',
    })
    em.persist(first)
    await em.flush()

    const duplicate = em.create(Certification, {
      name: 'Test Cert Unique Duplicate',
      provider: 'Test',
      code: 'TEST-UNIQUE-001',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 45,
      passingScore: 700,
      timeLimitMinutes: 45,
      provenance: 'verified',
    })
    em.persist(duplicate)
    await expect(em.flush()).rejects.toThrow()
  })

  it('accepts per-field citation provenance', async () => {
    const em = orm.em.fork()

    const cert = em.create(Certification, {
      name: 'Test Cert',
      provider: 'Test',
      code: 'TEST-001',
      domains: [{ name: 'Testing', weight: 100 }],
      questionCount: 10,
      passingScore: 70,
      timeLimitMinutes: 60,
      provenance: {
        questionCount: { url: 'https://example.com/guide', passage: 'The exam has 10 questions.' },
      },
    })
    em.persist(cert)
    await em.flush()
    em.clear()

    const persisted = await em.findOneOrFail(Certification, { id: cert.id })
    expect(persisted.provenance).toEqual({
      questionCount: { url: 'https://example.com/guide', passage: 'The exam has 10 questions.' },
    })
  })
})
