import * as http from 'node:http'
import * as net from 'node:net'
import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import {
  INTERNAL_API_SECRET_HEADER,
  LIFECYCLE_API_CLIENT,
  LifecycleApiClient,
} from './lifecycle-api.client'
import { LifecycleEmailModule } from './lifecycle-email.module'
import { NudgeSchedulerCron } from './nudge-scheduler.cron'

interface CapturedRequest {
  method: string
  url: string
  secret: string | undefined
  body: { userCertificationIds: string[] }
}

const SECRET = 'test-internal-secret'

const USER_ID = '00000000-0000-0000-0000-0000000000b0'
const CERT_ID = '00000000-0000-0000-0000-0000000000b1'
const LULLED_ENROLLMENT = '00000000-0000-0000-0000-0000000000c1'
const RECENT_ENROLLMENT = '00000000-0000-0000-0000-0000000000c2'
const RESPONDED_ENROLLMENT = '00000000-0000-0000-0000-0000000000c3'

// Default NUDGE_ACTIVITY_LULL_DAYS is 7.
const FIXED_NOW = new Date('2026-06-29T12:00:00Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000
const LULLED_ACTIVITY = new Date(FIXED_NOW.getTime() - 10 * MS_PER_DAY)
const RECENT_ACTIVITY = new Date(FIXED_NOW.getTime() - 1 * MS_PER_DAY)

describe('NudgeSchedulerCron (integration)', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let cron: NudgeSchedulerCron
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

    cron = moduleRef.get(NudgeSchedulerCron)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
    stubServer?.close()
  })

  beforeEach(async () => {
    captured.length = 0
    const conn = em.fork().getConnection()
    await conn.execute('TRUNCATE TABLE users CASCADE')

    await conn.execute(
      `INSERT INTO users (id, email, password_hash, email_verified, display_timezone, created_at, updated_at)
       VALUES (?, 'nudge@example.com', 'hash', true, 'UTC', now(), now())`,
      [USER_ID],
    )
    await conn.execute(
      `INSERT INTO certifications
         (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, state, provenance, created_at, updated_at)
       VALUES (?, 'AWS CLF', 'AWS', 'CLF', '[]'::jsonb, 65, 700, 90, 'live', '"verified"'::jsonb, now(), now())`,
      [CERT_ID],
    )

    await seedEnrollment(LULLED_ENROLLMENT, null, LULLED_ACTIVITY)
    await seedEnrollment(RECENT_ENROLLMENT, null, RECENT_ACTIVITY)
    await seedEnrollment(RESPONDED_ENROLLMENT, 'passed', LULLED_ACTIVITY)
  })

  async function seedEnrollment(
    enrollmentId: string,
    examOutcomeResponse: string | null,
    activityAt: Date,
  ): Promise<void> {
    const conn = em.fork().getConnection()
    await conn.execute(
      `INSERT INTO user_certifications
         (id, user_id, certification_id, status, enrolled_at, exam_outcome_nudge_count, exam_outcome_response, created_at, updated_at)
       VALUES (?, ?, ?, 'active', now(), 0, ?, now(), now())`,
      [enrollmentId, USER_ID, CERT_ID, examOutcomeResponse],
    )
    await conn.execute(
      `INSERT INTO quiz_responses
         (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, 'A', true, 4, 5000, '{}'::jsonb, 'multiple_choice', ?, ?)`,
      [enrollmentId, activityAt.toISOString(), activityAt.toISOString()],
    )
  }

  it('POSTs only the lulled, unexhausted enrollment to the internal nudge endpoint', async () => {
    await cron.scheduleExamNudges(FIXED_NOW)

    expect(captured).toHaveLength(1)
    const request = captured[0]!
    expect(request.method).toBe('POST')
    expect(request.url).toBe('/internal/lifecycle/nudge')
    expect(request.secret).toBe(SECRET)
    expect(request.body.userCertificationIds).toEqual([LULLED_ENROLLMENT])
  })

  it('does not call the endpoint when every active enrollment is recently active or responded', async () => {
    const conn = em.fork().getConnection()
    await conn.execute('DELETE FROM user_certifications WHERE id = ?', [LULLED_ENROLLMENT])

    await cron.scheduleExamNudges(FIXED_NOW)

    expect(captured).toHaveLength(0)
  })
})
