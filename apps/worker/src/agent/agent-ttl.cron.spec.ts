import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { ACTIVE_STANDALONE_CONVERSATIONS_GAUGE, AgentTtlCron } from './agent-ttl.cron'

function getGaugeToken(name: string): string {
  return `PROM_METRIC_${name.toUpperCase()}`
}

const USER_ID = '00000000-0000-0000-0000-000000000001'

describe('AgentTtlCron (integration)', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let cron: AgentTtlCron
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
        AgentTtlCron,
        makeGaugeProvider({
          name: ACTIVE_STANDALONE_CONVERSATIONS_GAUGE,
          help: 'Current number of active standalone agent conversations',
        }),
      ],
    }).compile()
    await moduleRef.init()

    cron = moduleRef.get(AgentTtlCron)
    gauge = moduleRef.get<Gauge>(getGaugeToken(ACTIVE_STANDALONE_CONVERSATIONS_GAUGE))
    em = moduleRef.get(EntityManager)

    await seedRequiredFkRows(em)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
  })

  beforeEach(async () => {
    await em.fork().getConnection().execute('TRUNCATE TABLE agent_conversations CASCADE')
  })

  it('soft-deletes standalone conversations inactive for more than 4 hours', async () => {
    const staleTime = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const id = await seedConversation(em, 'standalone', staleTime)

    const now = new Date()
    await cron.cleanupStaleStandaloneConversations(now)

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ deleted_at: string | null }[]>(
        'SELECT deleted_at FROM agent_conversations WHERE id = ?',
        [id],
      )
    expect(rows[0]!.deleted_at).not.toBeNull()
  })

  it('leaves recently-active standalone conversations untouched', async () => {
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000)
    const id = await seedConversation(em, 'standalone', recentTime)

    await cron.cleanupStaleStandaloneConversations(new Date())

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ deleted_at: string | null }[]>(
        'SELECT deleted_at FROM agent_conversations WHERE id = ?',
        [id],
      )
    expect(rows[0]!.deleted_at).toBeNull()
  })

  it('ignores session-linked conversations regardless of age', async () => {
    const staleTime = new Date(Date.now() - 100 * 60 * 60 * 1000)
    const id = await seedConversation(em, 'in_session', staleTime, {
      studySessionId: '00000000-0000-0000-0000-0000000000aa',
    })

    await cron.cleanupStaleStandaloneConversations(new Date())

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ deleted_at: string | null }[]>(
        'SELECT deleted_at FROM agent_conversations WHERE id = ?',
        [id],
      )
    expect(rows[0]!.deleted_at).toBeNull()
  })

  it('skips already soft-deleted conversations', async () => {
    const staleTime = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const deletedAt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const id = await seedConversation(em, 'standalone', staleTime, { deletedAt })

    await cron.cleanupStaleStandaloneConversations(new Date())

    const rows = await em
      .fork()
      .getConnection()
      .execute<{ deleted_at: string }[]>(
        'SELECT deleted_at FROM agent_conversations WHERE id = ?',
        [id],
      )
    expect(new Date(rows[0]!.deleted_at).getTime()).toBe(deletedAt.getTime())
  })

  it('updates the active-standalone gauge after running', async () => {
    const staleTime = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000)
    await seedConversation(em, 'standalone', staleTime)
    await seedConversation(em, 'standalone', recentTime)

    await cron.cleanupStaleStandaloneConversations(new Date())

    const gaugeValue = await gauge.get()
    const metric = gaugeValue.values.find((v) => v.value !== undefined)
    expect(metric?.value).toBe(1)
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
}

async function seedConversation(
  em: EntityManager,
  mode: 'standalone' | 'in_session',
  lastActivityAt: Date,
  opts: { studySessionId?: string; deletedAt?: Date } = {},
): Promise<string> {
  const result = await em
    .fork()
    .getConnection()
    .execute<{ id: string }[]>(
      `INSERT INTO agent_conversations
         (id, user_id, study_session_id, certification_id, mode, last_activity_at, deleted_at, created_at, updated_at)
       VALUES
         (gen_random_uuid(), ?, ?, NULL, ?, ?, ?, now(), now())
       RETURNING id`,
      [
        USER_ID,
        opts.studySessionId ?? null,
        mode,
        lastActivityAt.toISOString(),
        opts.deletedAt ? opts.deletedAt.toISOString() : null,
      ],
    )
  return result[0]!.id
}
