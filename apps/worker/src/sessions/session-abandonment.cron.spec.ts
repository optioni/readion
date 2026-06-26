import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { ACTIVE_SESSIONS_GAUGE, SessionAbandonmentCron } from './session-abandonment.cron'

function getGaugeToken(name: string): string {
  return `PROM_METRIC_${name.toUpperCase()}`
}

const USER_ID = '00000000-0000-0000-0000-000000000001'
const CERT_ID = '00000000-0000-0000-0000-000000000002'
const CERT_ID_2 = '00000000-0000-0000-0000-000000000005'
const ENROLLMENT_ID = '00000000-0000-0000-0000-000000000003'
const ENROLLMENT_ID_2 = '00000000-0000-0000-0000-000000000004'

describe('SessionAbandonmentCron (integration)', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let cron: SessionAbandonmentCron
  let gauge: Gauge
  let em: EntityManager

  beforeAll(async () => {
    harness = await createDbHarness()

    // createDbHarness sets DB_HOST/DB_PORT/DB_NAME; WorkerConfigModule also needs these
    process.env.DATABASE_URL = `postgresql://readion:readion@${process.env.DB_HOST}:${process.env.DB_PORT}/readion_test`
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.NODE_ENV = 'test'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [
        SessionAbandonmentCron,
        makeGaugeProvider({
          name: ACTIVE_SESSIONS_GAUGE,
          help: 'Current number of active study sessions',
        }),
      ],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(SessionAbandonmentCron)
    gauge = moduleRef.get<Gauge>(getGaugeToken(ACTIVE_SESSIONS_GAUGE))
    em = moduleRef.get(EntityManager)

    await seedRequiredFkRows(em)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
  })

  beforeEach(async () => {
    await em.fork().getConnection().execute('TRUNCATE TABLE study_sessions CASCADE')
  })

  it('marks active sessions older than 24h as abandoned', async () => {
    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const sessionId = await seedSession(em, staleTime)

    const now = new Date()
    await cron.abandonStaleSessions(now)

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ status: string; ended_at: string | null }[]>(
        'SELECT status, ended_at FROM study_sessions WHERE id = ?',
        [sessionId],
      )
    expect(rows[0]!.status).toBe('abandoned')
    expect(rows[0]!.ended_at).not.toBeNull()
  })

  it('leaves active sessions started within 24h untouched', async () => {
    const recentTime = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const sessionId = await seedSession(em, recentTime)

    await cron.abandonStaleSessions(new Date())

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ status: string }[]>('SELECT status FROM study_sessions WHERE id = ?', [sessionId])
    expect(rows[0]!.status).toBe('active')
  })

  it('does not touch already-ended sessions', async () => {
    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const sessionId = await seedSession(em, staleTime, 'completed')

    await cron.abandonStaleSessions(new Date())

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ status: string }[]>('SELECT status FROM study_sessions WHERE id = ?', [sessionId])
    expect(rows[0]!.status).toBe('completed')
  })

  it('updates the active-session gauge after running', async () => {
    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000)

    // Two different enrollments to avoid the one-active-per-enrollment constraint
    await seedSession(em, staleTime, 'active', ENROLLMENT_ID)
    await seedSession(em, recentTime, 'active', ENROLLMENT_ID_2)

    await cron.abandonStaleSessions(new Date())

    const gaugeValue = await gauge.get()
    const activeMetric = gaugeValue.values.find((v) => v.value !== undefined)
    expect(activeMetric?.value).toBe(1)
  })
})

async function seedRequiredFkRows(em: EntityManager) {
  const conn = em.fork().getConnection()
  await conn.execute(
    `INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
     VALUES (?, 'test@example.com', 'hash', true, now(), now())
     ON CONFLICT DO NOTHING`,
    [USER_ID],
  )
  await conn.execute(
    `INSERT INTO certifications (id, name, code, provider, state, domains, question_count, passing_score, time_limit_minutes, provenance, created_at, updated_at)
     VALUES (?, 'Test Cert', 'TEST-01', 'aws', 'live', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, now(), now()),
            (?, 'Test Cert 2', 'TEST-02', 'aws', 'live', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, now(), now())
     ON CONFLICT DO NOTHING`,
    [CERT_ID, CERT_ID_2],
  )
  await conn.execute(
    `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
     VALUES (?, ?, ?, 'active', now(), now(), now()),
            (?, ?, ?, 'active', now(), now(), now())
     ON CONFLICT DO NOTHING`,
    [ENROLLMENT_ID, USER_ID, CERT_ID, ENROLLMENT_ID_2, USER_ID, CERT_ID_2],
  )
}

async function seedSession(
  em: EntityManager,
  startedAt: Date,
  status = 'active',
  enrollmentId = ENROLLMENT_ID,
): Promise<string> {
  const result = await em
    .fork()
    .getConnection()
    .execute<{ id: string }[]>(
      `INSERT INTO study_sessions
         (id, user_id, user_certification_id, kind, status, duration_minutes,
          content_mix, difficulty, focus_area, learning_style, last_item_index,
          started_at, ended_at, created_at, updated_at)
       VALUES
         (gen_random_uuid(), ?, ?, 'study', ?, 30, 'balanced', 'intermediate',
          '{"mode":"auto"}', 'weak-area-focus', 0, ?, NULL, now(), now())
       RETURNING id`,
      [USER_ID, enrollmentId, status, startedAt.toISOString()],
    )
  return result[0]!.id
}
