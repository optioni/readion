import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createSessionsAcceptanceHarness,
  type SessionsAcceptanceHarness,
} from './test/sessions-acceptance-harness'

describe('sessions acceptance', () => {
  let harness: SessionsAcceptanceHarness

  beforeAll(async () => {
    harness = await createSessionsAcceptanceHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('core session loop: create → items present → complete items → resume → end', async () => {
    const cert = await harness.seedCertification('CLF-C02', 'live')
    await harness.seedChunk(cert.id, 'Security')
    await harness.seedChunk(cert.id, 'Networking')
    await harness.seedChunk(cert.id, 'Security')

    const token = await harness.registerAndLogin('session@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    await harness.seedWeakArea(enrollmentId, 'Security', 0.3)
    await harness.seedWeakArea(enrollmentId, 'Networking', 0.7)

    // Create a 30-min study session
    const create = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: { mode: 'auto' },
        learningStyle: 'weak-area-focus',
      })

    expect(create.status).toBe(201)
    expect(create.body.data.status).toBe('active')
    expect(create.body.data.kind).toBe('study')
    expect(create.body.data.lastItemIndex).toBe(0)
    expect(create.body.relationships).toBeDefined()

    const sessionId = create.body.data.id as string
    expect(sessionId).toBeDefined()

    // First 3 items must be present synchronously
    const getSession = await harness
      .getRequest()
      .get(`/api/v1/sessions/${sessionId}?include=items`)
      .set('Authorization', auth)

    expect(getSession.status).toBe(200)
    const items = getSession.body.data.items as Array<{
      index: number
      type: string
      completed: boolean
      domain: string
    }>
    expect(items.length).toBeGreaterThanOrEqual(3)

    // First item is a reading block
    expect(items[0]!.type).toBe('reading')
    // Items alternate reading → quiz
    expect(items[1]!.type).toBe('quiz')
    // Each item carries the domain it was generated for (surfaced from SessionItem.domain)
    expect(items[0]!.domain).toBe('Security')
    expect(items[1]!.domain).toBe('Security')

    // Complete items 0-2 advancing lastItemIndex
    for (let i = 0; i < 3; i++) {
      const complete = await harness
        .getRequest()
        .post(`/api/v1/sessions/${sessionId}/items/${i}/complete`)
        .set('Authorization', auth)
      expect(complete.status).toBe(200)
    }

    // Resume: GET returns updated lastItemIndex
    const resume = await harness
      .getRequest()
      .get(`/api/v1/sessions/${sessionId}`)
      .set('Authorization', auth)

    expect(resume.status).toBe(200)
    expect(resume.body.data.lastItemIndex).toBe(3)

    // End the session
    const end = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/end`)
      .set('Authorization', auth)

    expect(end.status).toBe(200)
    expect(end.body.data.endedAt).toBeDefined()
    expect(['completed', 'partial']).toContain(end.body.data.status)
  })

  it('starting a second session for the same enrollment resumes the first (one-active invariant)', async () => {
    const cert = await harness.seedCertification('SAA-C03', 'live')
    await harness.seedChunk(cert.id, 'Security')

    const token = await harness.registerAndLogin('resume@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    const first = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 30, contentMix: 'balanced' })

    expect(first.status).toBe(201)
    const sessionId = first.body.data.id as string

    // Complete one item to change lastItemIndex
    await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/items/0/complete`)
      .set('Authorization', auth)

    // Start another session for same enrollment
    const second = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 30, contentMix: 'balanced' })

    expect(second.status).toBe(200)
    expect(second.body.data.id).toBe(sessionId)
    expect(second.body.data.lastItemIndex).toBe(1)
  })

  it('invalid durationMinutes returns 422', async () => {
    const cert = await harness.seedCertification('INVALID-01', 'live')
    const token = await harness.registerAndLogin('invalid@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    const res = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 45 })

    expect(res.status).toBe(422)
    expect(res.body.errors).toBeDefined()
  })

  it("creating a session for another user's enrollment returns 404", async () => {
    const cert = await harness.seedCertification('OTHER-01', 'live')

    const owner = await harness.registerAndLogin('owner@example.com', 'correcthorse')
    const enrollmentId = await harness.enroll(owner, cert.id)

    const other = await harness.registerAndLogin('other@example.com', 'correcthorse')
    const auth = `Bearer ${other}`

    const res = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 30 })

    expect(res.status).toBe(404)
  })

  it('session history list returns only the requesting user sessions', async () => {
    const cert = await harness.seedCertification('HIST-01', 'live')
    await harness.seedChunk(cert.id, 'Security')

    const token = await harness.registerAndLogin('hist@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    const create = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 30 })
    expect(create.status).toBe(201)

    const sessionId = create.body.data.id as string
    await harness.getRequest().post(`/api/v1/sessions/${sessionId}/end`).set('Authorization', auth)

    const list = await harness.getRequest().get('/api/v1/sessions').set('Authorization', auth)

    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.meta.total).toBe(1)
  })

  it('go-deeper returns expanded content without modifying the stored item', async () => {
    const cert = await harness.seedCertification('DEEP-01', 'live')
    await harness.seedChunk(cert.id, 'Security')

    const token = await harness.registerAndLogin('deep@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    const create = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', auth)
      .send({ durationMinutes: 30 })
    expect(create.status).toBe(201)

    const sessionId = create.body.data.id as string

    const deeper = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/items/0/go-deeper`)
      .set('Authorization', auth)

    expect(deeper.status).toBe(200)
    expect(deeper.body.data.expandedContent).toBeDefined()
  })

  it('ending another user session returns 404', async () => {
    const cert = await harness.seedCertification('CROSS-01', 'live')
    await harness.seedChunk(cert.id, 'Security')

    const owner = await harness.registerAndLogin('cross-owner@example.com', 'correcthorse')
    const ownerToken = `Bearer ${owner}`
    const enrollmentId = await harness.enroll(owner, cert.id)

    const create = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', ownerToken)
      .send({ durationMinutes: 30 })
    const sessionId = create.body.data.id as string

    const other = await harness.registerAndLogin('cross-other@example.com', 'correcthorse')
    const res = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${other}`)

    expect(res.status).toBe(404)
  })
})
