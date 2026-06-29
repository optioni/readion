import type { INestApplication } from '@nestjs/common'
import type { ExtractiveItem, Provenance } from '@readion/shared'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createQuarantineAdminAcceptanceHarness,
  type QuarantineAdminAcceptanceHarness,
} from './test/quarantine-admin-acceptance-harness'

const FIXTURE_PROVENANCE: Provenance = {
  sourceChunkIds: ['chunk-1'],
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  verdict: { pass: false, score: 0.2, distractorFindings: [] },
  score: 0.2,
}

const FIXTURE_ITEM: ExtractiveItem = {
  question: 'What does Amazon EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS resolution', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

const QUESTION_KEY = 'quarantine-acceptance-question-key'
const REPORT_REASON = 'The answer key is incorrect'

describe('admin quarantine review queue (acceptance)', () => {
  let harness: QuarantineAdminAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createQuarantineAdminAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  // The first registration in a fresh isolated DB yields an admin; subsequent
  // registrations are plain users. The plain user is the one who reports a
  // question, which drives the grounding quarantine point that must now persist
  // a reviewable `pending` row.
  async function setupActors() {
    const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
    return { adminToken, userToken }
  }

  async function quarantineOneItem(userToken: string): Promise<{ certificationId: string }> {
    const cert = await harness.seedLiveCertification('QADMIN-01')
    const enrollmentId = await harness.enroll(userToken, cert.id)
    await harness.seedCacheEntry(
      QUESTION_KEY,
      ['chunk-1'],
      FIXTURE_ITEM,
      FIXTURE_PROVENANCE,
      'multiple_choice',
    )

    const report = await supertest(app.getHttpServer())
      .post(`/api/v1/quiz/${QUESTION_KEY}/report`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ userCertificationId: enrollmentId, reason: REPORT_REASON })

    expect(report.status).toBe(204)
    return { certificationId: cert.id }
  }

  it('persists a pending quarantined item at the grounding quarantine point and lists it for admins', async () => {
    const { adminToken, userToken } = await setupActors()
    const { certificationId } = await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.meta).toBeDefined()
    expect(list.body.meta.limit).toBe(25)

    expect(list.body.data).toHaveLength(1)
    const item = list.body.data[0]
    expect(item.id).toBeDefined()
    expect(item.status).toBe('pending')
    expect(item.reason).toBe(REPORT_REASON)
    expect(item.certificationId).toBe(certificationId)
    expect(item.domain).toBeDefined()
    expect(item.verdict).toBeDefined()
    expect(item.provenance).toBeDefined()
  })

  it('paginates the queue with a default page size of 25 and a max of 100', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const oversized = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?limit=500')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(oversized.status).toBe(200)
    expect(oversized.body.meta.limit).toBe(100)
  })

  it('filters the queue by certification', async () => {
    const { adminToken, userToken } = await setupActors()
    const { certificationId } = await quarantineOneItem(userToken)

    const filtered = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/quarantine?certificationId=${certificationId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(filtered.status).toBe(200)
    expect(filtered.body.data).toHaveLength(1)
    expect(filtered.body.data[0].certificationId).toBe(certificationId)
  })

  it('forbids non-admin users from reading the queue with 403 problem+json', async () => {
    const { userToken } = await setupActors()

    const forbidden = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')
  })

  it('approves a pending item: re-instates it, flips status to approved, and writes an audit entry', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    const approve = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(approve.status).toBe(200)
    expect(approve.body.data).toMatchObject({ id: itemId, status: 'approved' })

    const auditLogs = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(auditLogs.status).toBe(200)

    const entry = auditLogs.body.data.find((log: { targetId: string }) => log.targetId === itemId)
    expect(entry).toBeDefined()
    expect(entry.action).toBe('quarantine.approved')
    expect(entry.before).toMatchObject({ status: 'pending' })
    expect(entry.after).toMatchObject({ status: 'approved' })
  })

  it('rejects a pending item: flips status to rejected without re-instating, and writes an audit entry', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    const reject = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(reject.status).toBe(200)
    expect(reject.body.data).toMatchObject({ id: itemId, status: 'rejected' })

    const auditLogs = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(auditLogs.status).toBe(200)

    const entry = auditLogs.body.data.find((log: { targetId: string }) => log.targetId === itemId)
    expect(entry).toBeDefined()
    expect(entry.action).toBe('quarantine.rejected')
    expect(entry.after).toMatchObject({ status: 'rejected' })
  })
})
