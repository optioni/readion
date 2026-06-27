import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { Certification, createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../../config/config.module'
import {
  CERT_REVERIFICATION_CRON,
  CERTS_DUE_FOR_REVERIFICATION_GAUGE,
  CertReverificationCron,
} from './cert-reverification.cron'
import { STALE_SOURCE_CRON } from './stale-source.cron'

function getGaugeToken(name: string): string {
  return `PROM_METRIC_${name.toUpperCase()}`
}

const DAY_MS = 24 * 60 * 60 * 1000

describe('CertReverificationCron (integration)', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let cron: CertReverificationCron
  let gauge: Gauge
  let em: EntityManager

  beforeAll(async () => {
    harness = await createDbHarness()

    process.env.DATABASE_URL = `postgresql://readion:readion@${process.env.DB_HOST}:${process.env.DB_PORT}/readion_test`
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.NODE_ENV = 'test'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [
        CertReverificationCron,
        makeGaugeProvider({
          name: CERTS_DUE_FOR_REVERIFICATION_GAUGE,
          help: 'Current number of certifications due for re-verification',
        }),
      ],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(CertReverificationCron)
    gauge = moduleRef.get<Gauge>(getGaugeToken(CERTS_DUE_FOR_REVERIFICATION_GAUGE))
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
  })

  beforeEach(async () => {
    await em.fork().getConnection().execute('TRUNCATE TABLE certifications CASCADE')
  })

  async function seedCert(verifiedAt: Date | null, suffix: string): Promise<string> {
    const fork = em.fork()
    const cert = fork.create(Certification, {
      name: `Cert ${suffix}`,
      provider: 'aws',
      code: `REVERIFY-${suffix}`,
      domains: [{ name: 'Security', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
      verifiedAt,
    })
    fork.persist(cert)
    await fork.flush()
    return cert.id
  }

  it('sets the due-count gauge to the number of certs aged past the interval', async () => {
    const now = new Date()
    const old = new Date(now.getTime() - 200 * DAY_MS)
    await seedCert(old, 'A')
    await seedCert(old, 'B')
    await seedCert(old, 'C')
    // Freshly-verified cert must NOT count as due
    await seedCert(new Date(now.getTime() - 10 * DAY_MS), 'FRESH')

    await cron.surfaceDueCertifications(now)

    const gaugeValue = await gauge.get()
    const metric = gaugeValue.values.find((v) => v.value !== undefined)
    expect(metric?.value).toBe(3)
  })

  it('mutates no certification row', async () => {
    const now = new Date()
    const old = new Date(now.getTime() - 200 * DAY_MS)
    const ids = await Promise.all([seedCert(old, 'X'), seedCert(old, 'Y'), seedCert(old, 'Z')])

    const before = await em
      .fork()
      .getConnection()
      .execute<{ id: string; verified_at: string; updated_at: string }[]>(
        'SELECT id, verified_at, updated_at FROM certifications ORDER BY id',
      )

    await cron.surfaceDueCertifications(now)

    const after = await em
      .fork()
      .getConnection()
      .execute<{ id: string; verified_at: string; updated_at: string }[]>(
        'SELECT id, verified_at, updated_at FROM certifications ORDER BY id',
      )

    expect(after).toEqual(before)
    const afterIds = after.map((row: { id: string }) => row.id).sort()
    expect(afterIds).toEqual([...ids].sort())
  })

  it('is registered as a cron distinct from the stale-source cron', () => {
    expect(CERT_REVERIFICATION_CRON).not.toBe(STALE_SOURCE_CRON)
  })
})
