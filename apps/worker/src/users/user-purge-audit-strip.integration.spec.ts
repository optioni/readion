import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, type DbHarness, DbModule } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { UserPurgeService } from './user-purge.service'
import { UsersModule } from './users.module'

describe('UserPurgeService audit identifier strip integration', () => {
  let harness: DbHarness
  let moduleRef: TestingModule
  let em: EntityManager
  let service: UserPurgeService

  beforeAll(async () => {
    harness = await createDbHarness()
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.NODE_ENV = 'test'
    process.env.LIFECYCLE_DELETION_GRACE_DAYS = '14'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule, UsersModule],
    }).compile()
    await moduleRef.init()

    em = moduleRef.get(EntityManager).fork()
    service = moduleRef.get(UserPurgeService)
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
    em = moduleRef.get(EntityManager).fork()
  })

  afterAll(async () => {
    await moduleRef?.close()
    await harness?.teardown()
  })

  it('hard-purges the actor while retaining the audit_logs row with user_id nulled and other columns unchanged', async () => {
    const actorId = '00000000-0000-4000-8000-000000000301'
    const auditId = '00000000-0000-4000-8000-000000000401'
    const targetId = '00000000-0000-4000-8000-000000000402'

    await insertUser(em, {
      id: actorId,
      email: 'actor@example.com',
      deletedAt: '2026-06-01T00:00:00.000Z',
    })
    await insertAuditLog(em, {
      id: auditId,
      userId: actorId,
      action: 'user.role.promoted',
      targetType: 'user',
      targetId,
      before: '{"role":"user"}',
      after: '{"role":"admin"}',
    })

    const [seeded] = await selectAuditLog(em, auditId)

    await service.purgeEligibleDeletedUsers(new Date('2026-06-24T12:00:00.000Z'))

    expect(await countUsers(em, actorId)).toBe(0)

    const rows = await selectAuditLog(em, auditId)
    expect(rows).toHaveLength(1)

    const [row] = rows
    expect(row.user_id).toBeNull()
    expect(row.action).toBe(seeded.action)
    expect(row.target_type).toBe(seeded.target_type)
    expect(row.target_id).toBe(seeded.target_id)
    expect(row.before).toEqual(seeded.before)
    expect(row.after).toEqual(seeded.after)
    expect(new Date(row.created_at).getTime()).toBe(new Date(seeded.created_at).getTime())
  })
})

async function insertUser(
  em: EntityManager,
  input: { deletedAt: string | null; email: string; id: string },
) {
  await em.getConnection().execute(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, 'user', now(), now(), ?)
    `,
    [
      input.id,
      input.email,
      '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      input.deletedAt,
    ],
  )
}

async function insertAuditLog(
  em: EntityManager,
  input: {
    action: string
    after: string
    before: string
    id: string
    targetId: string
    targetType: string
    userId: string
  },
) {
  await em.getConnection().execute(
    `
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        target_type,
        target_id,
        before,
        after,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, now(), now())
    `,
    [
      input.id,
      input.userId,
      input.action,
      input.targetType,
      input.targetId,
      input.before,
      input.after,
    ],
  )
}

interface AuditLogRow {
  action: string
  after: unknown
  before: unknown
  created_at: string
  target_id: string
  target_type: string
  user_id: string | null
}

function selectAuditLog(em: EntityManager, id: string) {
  return em
    .getConnection()
    .execute<AuditLogRow[]>(
      'SELECT user_id, action, target_type, target_id, before, after, created_at FROM audit_logs WHERE id = ?',
      [id],
    )
}

async function countUsers(em: EntityManager, id: string) {
  const [{ count }] = await em
    .getConnection()
    .execute<{ count: string }[]>('SELECT count(*) FROM users WHERE id = ?', [id])
  return Number(count)
}
