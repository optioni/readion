import * as http from 'node:http'
import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { DigestSchedulerCron } from './digest-scheduler.cron'
import { INTERNAL_API_SECRET_HEADER } from './lifecycle-api.client'
import { LifecycleEmailModule } from './lifecycle-email.module'

interface CapturedRequest {
  method: string
  url: string
  secret: string | undefined
  body: { userIds: string[] }
}

const SECRET = 'test-internal-secret'

const DUE_USER_ID = '00000000-0000-0000-0000-0000000000a1'
const OPTED_OUT_USER_ID = '00000000-0000-0000-0000-0000000000a2'
const ALREADY_SENT_USER_ID = '00000000-0000-0000-0000-0000000000a3'

// Mon 2026-06-29 09:00 Europe/Helsinki (UTC+3) == 06:00Z. DIGEST_SEND_HOUR=9, weekday=1.
const FIXED_NOW = new Date('2026-06-29T06:00:00Z')

describe('DigestSchedulerCron (integration)', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let cron: DigestSchedulerCron
  let em: EntityManager
  let stubServer: http.Server
  let captured: CapturedRequest[]

  beforeAll(async () => {
    captured = []
    stubServer = http.createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        captured.push({
          method: req.method ?? '',
          url: req.url ?? '',
          secret: req.headers[INTERNAL_API_SECRET_HEADER] as string | undefined,
          body: JSON.parse(Buffer.concat(chunks).toString() || '{}'),
        })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
      })
    })
    await new Promise<void>((resolve) => stubServer.listen(0, '127.0.0.1', resolve))
    const stubPort = (stubServer.address() as net.AddressInfo).port

    harness = await createDbHarness()
    process.env.DATABASE_URL = `postgresql://readion:readion@${process.env.DB_HOST}:${process.env.DB_PORT}/readion_test`
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.NODE_ENV = 'test'
    process.env.INTERNAL_API_BASE_URL = `http://127.0.0.1:${stubPort}`
    process.env.INTERNAL_API_SECRET = SECRET
    process.env.DIGEST_SEND_WEEKDAY = '1'
    process.env.DIGEST_SEND_HOUR = '9'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, LifecycleEmailModule],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(DigestSchedulerCron)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    stubServer?.close()
  })

  beforeEach(async () => {
    captured.length = 0
    await em.fork().getConnection().execute('TRUNCATE TABLE users CASCADE')
    await seedUser(em, DUE_USER_ID, 'due@example.com', 'Europe/Helsinki', false, null)
    await seedUser(em, OPTED_OUT_USER_ID, 'optedout@example.com', 'Europe/Helsinki', true, null)
    await seedUser(
      em,
      ALREADY_SENT_USER_ID,
      'sent@example.com',
      'Europe/Helsinki',
      false,
      new Date('2026-06-29T05:00:00Z'),
    )
  })

  it('POSTs only the due user to the internal digest endpoint', async () => {
    await cron.scheduleWeeklyDigests(FIXED_NOW)

    expect(captured).toHaveLength(1)
    const request = captured[0]!
    expect(request.method).toBe('POST')
    expect(request.url).toBe('/internal/lifecycle/digest')
    expect(request.secret).toBe(SECRET)
    expect(request.body.userIds).toEqual([DUE_USER_ID])
  })

  it('does not call the endpoint when no users are due', async () => {
    // 04:00Z == Mon 07:00 Helsinki — wrong local hour.
    await cron.scheduleWeeklyDigests(new Date('2026-06-29T04:00:00Z'))

    expect(captured).toHaveLength(0)
  })
})

async function seedUser(
  em: EntityManager,
  id: string,
  email: string,
  timezone: string,
  optedOut: boolean,
  lastSentAt: Date | null,
): Promise<void> {
  await em
    .fork()
    .getConnection()
    .execute(
      `INSERT INTO users
         (id, email, password_hash, email_verified, display_timezone,
          digest_opt_out, last_digest_sent_at, created_at, updated_at)
       VALUES (?, ?, 'hash', true, ?, ?, ?, now(), now())`,
      [id, email, timezone, optedOut, lastSentAt ? lastSentAt.toISOString() : null],
    )
}
