import { createDbHarness, type DbHarness } from '@readion/db'
import { AuditAction } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AuditLogService } from './audit-log.service'

interface AuditLogRow {
  user_id: string | null
  action: string
  target_type: string
  target_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

async function seedUser(harness: DbHarness, email: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'hash', 'user', now(), now())
     RETURNING id`,
    [email],
  )
  return rows[0]!.id
}

async function loadRows(harness: DbHarness): Promise<AuditLogRow[]> {
  return harness
    .getEm()
    .getConnection()
    .execute<AuditLogRow[]>(
      `SELECT user_id, action, target_type, target_id, before, after, created_at
       FROM audit_logs ORDER BY created_at ASC`,
    )
}

describe('AuditLogService', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function service(): AuditLogService {
    if (!harness) throw new Error('DB harness was not initialized')
    return new AuditLogService(harness.getEm())
  }

  it('inserts exactly one append-only row capturing actor, action, target and snapshots', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const actorUserId = await seedUser(harness, 'admin@example.com')
    const targetUserId = await seedUser(harness, 'target@example.com')

    const created = await service().record({
      actorUserId,
      action: AuditAction.UserRolePromoted,
      targetType: 'user',
      targetId: targetUserId,
      before: { role: 'user' },
      after: { role: 'admin' },
    })

    expect(created.id).toBeDefined()
    expect(created.userId).toBe(actorUserId)

    const rows = await loadRows(harness)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.user_id).toBe(actorUserId)
    expect(rows[0]!.action).toBe(AuditAction.UserRolePromoted)
    expect(rows[0]!.target_type).toBe('user')
    expect(rows[0]!.target_id).toBe(targetUserId)
    expect(rows[0]!.before).toEqual({ role: 'user' })
    expect(rows[0]!.after).toEqual({ role: 'admin' })
    expect(rows[0]!.created_at).not.toBeNull()
  })

  it('appends a second row without overwriting the first', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const actorUserId = await seedUser(harness, 'admin@example.com')
    const targetUserId = await seedUser(harness, 'target@example.com')

    await service().record({
      actorUserId,
      action: AuditAction.UserRolePromoted,
      targetType: 'user',
      targetId: targetUserId,
      before: { role: 'user' },
      after: { role: 'admin' },
    })

    await service().record({
      actorUserId,
      action: AuditAction.UserRoleDemoted,
      targetType: 'user',
      targetId: targetUserId,
      before: { role: 'admin' },
      after: { role: 'user' },
    })

    const rows = await loadRows(harness)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.action).toBe(AuditAction.UserRolePromoted)
    expect(rows[0]!.before).toEqual({ role: 'user' })
    expect(rows[0]!.after).toEqual({ role: 'admin' })
    expect(rows[1]!.action).toBe(AuditAction.UserRoleDemoted)
  })

  it('records a system action with a null actor and null snapshots', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const targetUserId = await seedUser(harness, 'target@example.com')

    const created = await service().record({
      actorUserId: null,
      action: AuditAction.UserRolePromoted,
      targetType: 'user',
      targetId: targetUserId,
    })

    expect(created.userId).toBeNull()

    const rows = await loadRows(harness)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.user_id).toBeNull()
    expect(rows[0]!.before).toBeNull()
    expect(rows[0]!.after).toBeNull()
  })
})
