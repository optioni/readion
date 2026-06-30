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

const QUESTION_KEY = 'quarantine-actions-question-key'
const REPORT_REASON = 'The answer key is incorrect'

describe('admin quarantine review actions (integration)', () => {
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

  async function quarantineOneItem(userToken: string): Promise<void> {
    const cert = await harness.seedLiveCertification('QADMIN-ACT')
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
  }

  async function pendingItemId(adminToken: string): Promise<string> {
    const list = await supertest(app.getHttpServer())
      .get('/api/v1/admin/quarantine?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(list.status).toBe(200)
    return list.body.data[0].id as string
  }

  it('approve reinstates the verified cache entry rebuilt from generatedContent', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    expect(await harness.getCacheEntry(QUESTION_KEY)).toBeNull()

    const itemId = await pendingItemId(adminToken)
    const approve = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(approve.status).toBe(200)
    expect(approve.body.data).toMatchObject({ id: itemId, status: 'approved' })

    const reinstated = await harness.getCacheEntry(QUESTION_KEY)
    expect(reinstated).not.toBeNull()
    expect(reinstated?.verified).toBe(true)
    const payload = JSON.parse(reinstated?.text ?? '{}') as {
      item: ExtractiveItem
      provenance: Provenance
      format: string
    }
    expect(payload.item).toMatchObject({ question: FIXTURE_ITEM.question })
    expect(payload.format).toBe('multiple_choice')
    expect(payload.provenance.sourceChunkIds).toEqual(FIXTURE_PROVENANCE.sourceChunkIds)
  })

  it('reject flips status without reinstating the cache entry', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const itemId = await pendingItemId(adminToken)
    const reject = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(reject.status).toBe(200)
    expect(reject.body.data).toMatchObject({ id: itemId, status: 'rejected' })
    expect(await harness.getCacheEntry(QUESTION_KEY)).toBeNull()
  })

  it('returns 409 when resolving an item that is no longer pending', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)

    const itemId = await pendingItemId(adminToken)
    const first = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(first.status).toBe(200)

    const second = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(second.status).toBe(409)
    expect(second.headers['content-type']).toContain('application/problem+json')
  })

  it('forbids non-admin users from approving with 403 problem+json', async () => {
    const { adminToken, userToken } = await setupActors()
    await quarantineOneItem(userToken)
    const itemId = await pendingItemId(adminToken)

    const forbidden = await supertest(app.getHttpServer())
      .post(`/api/v1/admin/quarantine/${itemId}/approve`)
      .set('Authorization', `Bearer ${userToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.headers['content-type']).toContain('application/problem+json')
  })
})
