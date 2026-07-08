import { createDbHarness, type DbHarness } from '@readion/db'
import { AuditAction } from '@readion/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AdminService } from './admin.service'
import { AuditLogService } from './audit-log.service'
import { LastActiveAdminGuard } from '../users/last-active-admin.guard'

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

async function seedCertification(harness: DbHarness, name: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO certifications
       (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes,
        state, provenance, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'AWS', ?, '[]', 65, 700, 90, 'draft', '"verified"', now(), now())
     RETURNING id`,
    [name, `CODE-${Math.random().toString(36).slice(2, 8)}`],
  )
  return rows[0]!.id
}

async function seedContentSource(
  harness: DbHarness,
  certificationId: string,
  url: string,
): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_sources
       (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'web', ?, true, 1440, now(), now())
     RETURNING id`,
    [certificationId, url],
  )
  return rows[0]!.id
}

describe('AdminService.listAuditLogs read-model mapper', () => {
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

  function service(): AdminService {
    if (!harness) throw new Error('DB harness was not initialized')
    const em = harness.getEm()
    return new AdminService(em, new LastActiveAdminGuard(), new AuditLogService(em))
  }

  it('resolves actorEmail and targetLabel for a user.role.promoted entry', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const actorUserId = await seedUser(harness, 'admin@example.com')
    const targetUserId = await seedUser(harness, 'target@example.com')

    await service().promote(actorUserId, targetUserId)

    const { items } = await service().listAuditLogs()
    const entry = items.find((item) => item.targetId === targetUserId)

    expect(entry).toBeDefined()
    expect(entry?.actorEmail).toBe('admin@example.com')
    expect(entry?.targetLabel).toBe('target@example.com')
  })

  it('sets actorEmail to null when the actor has been hard-purged (userId is null)', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const targetUserId = await seedUser(harness, 'target-purged@example.com')

    await new AuditLogService(harness.getEm()).record({
      actorUserId: null,
      action: AuditAction.UserRolePromoted,
      targetType: 'user',
      targetId: targetUserId,
      before: { role: 'user' },
      after: { role: 'admin' },
    })

    const { items } = await service().listAuditLogs()
    const entry = items.find((item) => item.targetId === targetUserId)

    expect(entry).toBeDefined()
    expect(entry?.actorEmail).toBeNull()
  })

  it('resolves targetLabel to the certification name for a certification action', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const actorUserId = await seedUser(harness, 'admin2@example.com')
    const certificationId = await seedCertification(harness, 'AWS Certified Cloud Practitioner')

    await new AuditLogService(harness.getEm()).record({
      actorUserId,
      action: AuditAction.CertPublished,
      targetType: 'certification',
      targetId: certificationId,
      before: { state: 'draft' },
      after: { state: 'live' },
    })

    const { items } = await service().listAuditLogs()
    const entry = items.find((item) => item.targetId === certificationId)

    expect(entry).toBeDefined()
    expect(entry?.targetLabel).toBe('AWS Certified Cloud Practitioner')
  })

  it('resolves targetLabel to a readable label for a source action', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const actorUserId = await seedUser(harness, 'admin3@example.com')
    const certificationId = await seedCertification(harness, 'Azure Fundamentals')
    const sourceId = await seedContentSource(
      harness,
      certificationId,
      'https://learn.microsoft.com/az-900',
    )

    await new AuditLogService(harness.getEm()).record({
      actorUserId,
      action: AuditAction.SourceAdded,
      targetType: 'ContentSource',
      targetId: sourceId,
      before: null,
      after: null,
    })

    const { items } = await service().listAuditLogs()
    const entry = items.find((item) => item.targetId === sourceId)

    expect(entry).toBeDefined()
    expect(entry?.targetLabel).toContain('https://learn.microsoft.com/az-900')
  })
})
