import * as http from 'node:http'
import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { DigestSchedulerCron } from './digest-scheduler.cron'
import {
  INTERNAL_API_SECRET_HEADER,
  LIFECYCLE_API_CLIENT,
  LifecycleApiClient,
} from './lifecycle-api.client'
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

// Default send-time is Monday (DIGEST_SEND_WEEKDAY=1) 13:00 (DIGEST_SEND_HOUR=13).
// Mon 2026-06-29 13:00 Europe/Helsinki (UTC+3) == 10:00Z.
const FIXED_NOW = new Date('2026-06-29T10:00:00Z')

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

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, LifecycleEmailModule],
    })
      .overrideProvider(LIFECYCLE_API_CLIENT)
      .useValue(new LifecycleApiClient(`http://127.0.0.1:${stubPort}`, SECRET))
      .compile()
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
      new Date('2026-06-29T09:00:00Z'),
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
    // 09:00Z == Mon 12:00 Helsinki — wrong local hour.
    await cron.scheduleWeeklyDigests(new Date('2026-06-29T09:00:00Z'))

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
