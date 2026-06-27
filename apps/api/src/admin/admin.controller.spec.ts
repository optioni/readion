import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AdminAcceptanceHarness,
  createAdminAcceptanceHarness,
} from './test/admin-acceptance-harness'

describe('AdminController', () => {
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

  async function findUserId(adminAuth: string, email: string): Promise<string> {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', adminAuth)
    const match = res.body.data.find((entry: { email: string }) => entry.email === email)
    return match.id as string
  }

  async function auditCountForTarget(adminAuth: string, targetId: string): Promise<number> {
    const res = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', adminAuth)
    return res.body.data.filter((entry: { targetId: string }) => entry.targetId === targetId).length
  }

  describe('GET /admin/users', () => {
    it('returns active users with role and enrollment count under a paginated envelope', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      await harness.seedActiveEnrollment('member@example.com')

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.meta).toBeDefined()

      const member = res.body.data.find(
        (entry: { email: string }) => entry.email === 'member@example.com',
      )
      expect(member).toMatchObject({ role: 'user' })
      expect(member.enrollmentCount).toBe(1)
    })

    it('clamps an oversized page size to the maximum', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/admin/users?perPage=500')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.meta.limit).toBeLessThanOrEqual(100)
    })

    it('rejects an unauthenticated request with 401', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/admin/users')
      expect(res.status).toBe(401)
    })

    it('rejects a user-role caller with 403', async () => {
      await harness.registerAndLogin('admin@example.com', 'correcthorse')
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('GET /admin/audit-logs', () => {
    it('returns audit entries newest-first under a paginated envelope', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const memberId = await findUserId(adminAuth, 'member@example.com')

      await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', adminAuth)
      await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/demote`)
        .set('Authorization', adminAuth)

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', adminAuth)

      expect(res.status).toBe(200)
      expect(res.body.meta).toBeDefined()
      const changes = res.body.data.filter(
        (entry: { targetId: string }) => entry.targetId === memberId,
      )
      expect(changes).toHaveLength(2)
      expect(changes[0].action).toBe('user.role.demoted')
      expect(changes[1].action).toBe('user.role.promoted')
      expect(changes[0]).toHaveProperty('createdAt')
    })

    it('rejects an unauthenticated request with 401', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/admin/audit-logs')
      expect(res.status).toBe(401)
    })

    it('rejects a user-role caller with 403', async () => {
      await harness.registerAndLogin('admin@example.com', 'correcthorse')
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('POST /admin/users/:id/promote', () => {
    it('promotes a user and records exactly one audit row', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const memberId = await findUserId(adminAuth, 'member@example.com')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', adminAuth)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: memberId, role: 'admin' })
      expect(await auditCountForTarget(adminAuth, memberId)).toBe(1)
    })

    it('is a no-op when the user is already an admin and writes no audit row', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const memberId = await findUserId(adminAuth, 'member@example.com')

      await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', adminAuth)
      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', adminAuth)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: memberId, role: 'admin' })
      expect(await auditCountForTarget(adminAuth, memberId)).toBe(1)
    })

    it('returns 404 for a missing user', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/promote')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('rejects a user-role caller with 403', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
      const memberId = await findUserId(`Bearer ${adminToken}`, 'member@example.com')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('POST /admin/users/:id/demote', () => {
    it('demotes an admin while another admin remains and records an audit row', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const memberId = await findUserId(adminAuth, 'member@example.com')

      await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/promote`)
        .set('Authorization', adminAuth)

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/demote`)
        .set('Authorization', adminAuth)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: memberId, role: 'user' })
      expect(await auditCountForTarget(adminAuth, memberId)).toBe(2)
    })

    it('returns 409 and writes no audit row when demoting the last active admin', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const adminId = await findUserId(adminAuth, 'admin@example.com')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${adminId}/demote`)
        .set('Authorization', adminAuth)

      expect(res.status).toBe(409)
      expect(await auditCountForTarget(adminAuth, adminId)).toBe(0)
    })

    it('is a no-op when the user is already a plain user and writes no audit row', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      await harness.registerAndLogin('member@example.com', 'correcthorse')
      const adminAuth = `Bearer ${adminToken}`
      const memberId = await findUserId(adminAuth, 'member@example.com')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/demote`)
        .set('Authorization', adminAuth)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: memberId, role: 'user' })
      expect(await auditCountForTarget(adminAuth, memberId)).toBe(0)
    })

    it('returns 404 for a missing user', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')

      const res = await supertest(app.getHttpServer())
        .post('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/demote')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('rejects a user-role caller with 403', async () => {
      const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
      const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
      const memberId = await findUserId(`Bearer ${adminToken}`, 'member@example.com')

      const res = await supertest(app.getHttpServer())
        .post(`/api/v1/admin/users/${memberId}/demote`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })
})
