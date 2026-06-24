import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createUserCertificationsAcceptanceHarness,
  type UserCertificationsAcceptanceHarness,
} from './test/user-certifications-acceptance-harness'

describe('user-certifications acceptance', () => {
  let harness: UserCertificationsAcceptanceHarness
  let app: INestApplication

  beforeAll(async () => {
    harness = await createUserCertificationsAcceptanceHarness()
    app = harness.app
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('full enrollment lifecycle: enroll → list → patch → archive → list → re-enroll', async () => {
    const liveCert = await harness.seedCertification('CLF-C02', 'live')
    await harness.seedCertification('DRAFT-01', 'draft')
    const token = await harness.registerAndLogin('test@example.com', 'correcthorse')
    const auth = `Bearer ${token}`

    // Enroll in live cert
    const enroll = await supertest(app.getHttpServer())
      .post('/api/v1/user-certifications')
      .set('Authorization', auth)
      .send({ certificationId: liveCert.id })

    expect(enroll.status).toBe(201)
    expect(enroll.body.data).toMatchObject({
      certificationId: liveCert.id,
      status: 'active',
    })
    expect(enroll.body.data.id).toBeDefined()
    expect(enroll.body.data.enrolledAt).toBeDefined()
    expect(enroll.body.relationships).toBeDefined()

    const enrollmentId = enroll.body.data.id as string

    // Appears in active list
    const list = await supertest(app.getHttpServer())
      .get('/api/v1/user-certifications')
      .set('Authorization', auth)

    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].id).toBe(enrollmentId)
    expect(list.body.meta).toMatchObject({ total: 1 })

    // Override a session pref
    const patch = await supertest(app.getHttpServer())
      .patch(`/api/v1/user-certifications/${enrollmentId}`)
      .set('Authorization', auth)
      .send({ sessionDefaults: { duration: 60 } })

    expect(patch.status).toBe(200)
    expect(patch.body.data.sessionDefaults.duration).toBe(60)

    // Archive it
    const archive = await supertest(app.getHttpServer())
      .post(`/api/v1/user-certifications/${enrollmentId}/archive`)
      .set('Authorization', auth)

    expect(archive.status).toBe(200)
    expect(archive.body.data.status).toBe('archived')

    // Confirm it leaves the active list
    const listAfterArchive = await supertest(app.getHttpServer())
      .get('/api/v1/user-certifications')
      .set('Authorization', auth)

    expect(listAfterArchive.body.data).toHaveLength(0)
    expect(listAfterArchive.body.meta.total).toBe(0)

    // Restore via re-enroll
    const reEnroll = await supertest(app.getHttpServer())
      .post('/api/v1/user-certifications')
      .set('Authorization', auth)
      .send({ certificationId: liveCert.id })

    expect(reEnroll.status).toBe(201)
    expect(reEnroll.body.data.id).toBe(enrollmentId)
    expect(reEnroll.body.data.status).toBe('active')
    expect(reEnroll.body.data.enrolledAt).toBe(enroll.body.data.enrolledAt)
  })
})
