import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AdminAcceptanceHarness,
  createAdminAcceptanceHarness,
} from './test/admin-acceptance-harness'

describe('admin acceptance', () => {
  let harness: AdminAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createAdminAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('admin lists users, promotes and demotes the second user, and reads the audit log newest-first', async () => {
    // First registration in a fresh isolated DB yields an admin.
    const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    // Second registration yields a plain user (the promote/demote target).
    await harness.registerAndLogin('member@example.com', 'correcthorse')
    await harness.seedActiveEnrollment('member@example.com')

    const adminAuth = `Bearer ${adminToken}`

    // Admin lists all active users with role + enrollment count.
    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', adminAuth)

    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.meta).toBeDefined()

    const admin = list.body.data.find(
      (entry: { email: string }) => entry.email === 'admin@example.com',
    )
    const member = list.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.com',
    )

    expect(admin).toMatchObject({ role: 'admin' })
    expect(member).toMatchObject({ role: 'user' })
    expect(Number.isInteger(admin.enrollmentCount)).toBe(true)
    expect(member.enrollmentCount).toBe(1)

    const memberId = member.id as string

    // Promote the second user.
    const promote = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${memberId}/promote`)
      .set('Authorization', adminAuth)

    expect(promote.status).toBe(200)
    expect(promote.body.data).toMatchObject({ id: memberId, role: 'admin' })

    // Demote them again.
    const demote = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${memberId}/demote`)
      .set('Authorization', adminAuth)

    expect(demote.status).toBe(200)
    expect(demote.body.data).toMatchObject({ id: memberId, role: 'user' })

    // Audit log shows both role-change entries newest-first.
    const auditLogs = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', adminAuth)

    expect(auditLogs.status).toBe(200)
    expect(auditLogs.body.meta).toBeDefined()

    const roleChanges = auditLogs.body.data.filter(
      (entry: { targetId: string }) => entry.targetId === memberId,
    )

    expect(roleChanges).toHaveLength(2)
    expect(roleChanges[0].action).toBe('user.role.demoted')
    expect(roleChanges[1].action).toBe('user.role.promoted')

    const newest = new Date(roleChanges[0].createdAt).getTime()
    const older = new Date(roleChanges[1].createdAt).getTime()
    expect(newest).toBeGreaterThanOrEqual(older)
  })

  it('audit log entries expose actorEmail (nullable) and a human targetLabel', async () => {
    const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    await harness.registerAndLogin('member@example.com', 'correcthorse')

    const adminAuth = `Bearer ${adminToken}`

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', adminAuth)

    const member = list.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.com',
    )
    const memberId = member.id as string

    await supertest(app.getHttpServer())
      .post(`/api/v1/admin/users/${memberId}/promote`)
      .set('Authorization', adminAuth)

    const certification = await harness.seedCertification('AWS Certified Cloud Practitioner')
    await harness.insertAuditLogEntry({
      actorUserId: null,
      action: 'cert.published',
      targetType: 'certification',
      targetId: certification.id,
      before: { state: 'draft' },
      after: { state: 'live' },
    })

    const auditLogs = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', adminAuth)

    expect(auditLogs.status).toBe(200)

    const promoteEntry = auditLogs.body.data.find(
      (entry: { targetId: string; action: string }) =>
        entry.targetId === memberId && entry.action === 'user.role.promoted',
    )
    expect(promoteEntry).toBeDefined()
    expect(promoteEntry.actorEmail).toBe('admin@example.com')
    expect(promoteEntry.targetLabel).toBe('member@example.com')

    const certEntry = auditLogs.body.data.find(
      (entry: { targetId: string }) => entry.targetId === certification.id,
    )
    expect(certEntry).toBeDefined()
    expect(certEntry.actorEmail).toBeNull()
    expect(typeof certEntry.targetLabel).toBe('string')
    expect(certEntry.targetLabel.length).toBeGreaterThan(0)
  })

  it('rejects a user-role caller hitting an admin route with 403 problem+json', async () => {
    await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')

    const forbidden = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')
  })
})
