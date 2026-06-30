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

const QUESTION_KEY = 'quarantine-detail-question-key'
const REPORT_REASON = 'The answer key is incorrect'

describe('admin quarantine item detail (acceptance)', () => {
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

  async function setupActors() {
    const adminToken = await harness.registerAndLogin('admin@example.com', 'correcthorse')
    const userToken = await harness.registerAndLogin('member@example.com', 'correcthorse')
    return { adminToken, userToken }
  }

  async function quarantineOneItem(userToken: string): Promise<{ certificationId: string }> {
    const cert = await harness.seedLiveCertification('QDETAIL-01')
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

  it('admin reads an existing item detail with mapped content fields', async () => {
    const { adminToken, userToken } = await setupActors()
    const { certificationId } = await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    const detail = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/quarantine/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(detail.status).toBe(200)
    expect(detail.body.data).toBeDefined()

    const data = detail.body.data
    expect(data.id).toBe(itemId)
    expect(data.certificationId).toBe(certificationId)
    expect(data.domain).toBeDefined()
    expect(data.verdict).toBeDefined()
    expect(data.reason).toBe(REPORT_REASON)
    expect(data.status).toBe('pending')
    expect(data.provenance).toBeDefined()
    expect(data.createdAt).toBeDefined()

    expect(data.content).toBeDefined()
    expect(data.content.question).toBe(FIXTURE_ITEM.question)
    expect(data.content.options).toEqual(FIXTURE_ITEM.options)
    expect(data.content.answerKey).toBe(FIXTURE_ITEM.correctAnswer)
    expect(data.content.format).toBe('multiple_choice')
  })

  it('forbids non-admin users from reading item detail with 403 problem+json', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    const forbidden = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/quarantine/${itemId}`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')
  })

  it('returns 401 for anonymous requests to item detail', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    const anon = await supertest(app.getHttpServer()).get(
      `/api/v1/admin/quarantine/${itemId}`,
    )

    expect(anon.status).toBe(401)
  })

  it('returns 404 problem+json for an unknown quarantine item id', async () => {
    const { adminToken } = await setupActors()
    const unknownId = '00000000-0000-0000-0000-000000000000'

    const notFound = await supertest(app.getHttpServer())
      .get(`/api/v1/admin/quarantine/${unknownId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(notFound.status).toBe(404)
    expect(notFound.headers['content-type']).toContain('application/problem+json')
  })

  it('does not write an audit log entry when reading item detail (read-only invariant)', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    const itemId = list.body.data[0].id as string

    await supertest(app.getHttpServer())
      .get(`/api/v1/admin/quarantine/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    const auditLogs = await supertest(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(auditLogs.status).toBe(200)

    const entry = auditLogs.body.data.find(
      (log: { targetId: string }) => log.targetId === itemId,
    )
    expect(entry).toBeUndefined()
  })
})
