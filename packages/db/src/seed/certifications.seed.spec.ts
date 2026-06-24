import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Certification, CertificationSchema } from '../entities/certification.entity'
import mikroOrmConfig from '../mikro-orm.config'
import { startPostgresContainer } from '../test-helpers/containers'
import { CERTIFICATION_SEED_DATA } from './certifications.seed'

describe('certification seed data validation', () => {
  it('every cert has domain weights summing to 100', () => {
    for (const cert of CERTIFICATION_SEED_DATA) {
      const sum = cert.domains.reduce((acc, d) => acc + d.weight, 0)
      expect(sum, `${cert.code} domain weights should sum to 100`).toBe(100)
    }
  })

  it('every cert has required exam-format fields', () => {
    for (const cert of CERTIFICATION_SEED_DATA) {
      expect(cert.questionCount, `${cert.code} questionCount`).toBeGreaterThan(0)
      expect(cert.passingScore, `${cert.code} passingScore`).toBeGreaterThan(0)
      expect(cert.timeLimitMinutes, `${cert.code} timeLimitMinutes`).toBeGreaterThan(0)
      expect(cert.name, `${cert.code} name`).toBeTruthy()
      expect(cert.provider, `${cert.code} provider`).toBeTruthy()
      expect(cert.domains, `${cert.code} domains`).not.toHaveLength(0)
    }
  })

  it('every cert has a non-empty unique code', () => {
    const codes = CERTIFICATION_SEED_DATA.map((c) => c.code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
    for (const code of codes) {
      expect(code).toBeTruthy()
    }
  })

  it('includes the primary-target CLF-C02 cert as AWS', () => {
    const clf = CERTIFICATION_SEED_DATA.find((c) => c.code === 'CLF-C02')
    expect(clf).toBeDefined()
    expect(clf!.provider).toBe('AWS')
    expect(clf!.domains.reduce((acc, d) => acc + d.weight, 0)).toBe(100)
  })
})

describe('certification seed idempotency', () => {
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

  it('seeds CLF-C02 as draft with verified provenance', async () => {
    const em = orm.em.fork()
    const cert = await em.findOneOrFail(Certification, { code: 'CLF-C02' })
    expect(cert.state).toBe('draft')
    expect(cert.provenance).toBe('verified')
    expect(cert.provider).toBe('AWS')
    expect(cert.verifiedAt).toBeInstanceOf(Date)
  })

  it('running seed inserts twice does not create duplicates', async () => {
    const em = orm.em.fork()
    const countBefore = await em.count(Certification)
    expect(countBefore).toBe(CERTIFICATION_SEED_DATA.length)

    const now = new Date().toISOString()
    for (const cert of CERTIFICATION_SEED_DATA) {
      const domainsJson = JSON.stringify(cert.domains).replace(/'/g, "''")
      await em.getConnection().execute(`
        INSERT INTO certifications (
          id, name, provider, code, domains,
          question_count, passing_score, time_limit_minutes,
          state, provenance, verified_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          '${cert.name.replace(/'/g, "''")}',
          '${cert.provider.replace(/'/g, "''")}',
          '${cert.code}',
          '${domainsJson}'::jsonb,
          ${cert.questionCount},
          ${cert.passingScore},
          ${cert.timeLimitMinutes},
          'draft',
          '"verified"'::jsonb,
          '2026-06-24T00:00:00.000Z',
          '${now}',
          '${now}'
        )
        ON CONFLICT (code) DO NOTHING
      `)
    }

    em.clear()
    const countAfter = await em.count(Certification)
    expect(countAfter).toBe(countBefore)
  })
})
