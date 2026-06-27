import { EntityManager } from '@mikro-orm/core'
import { UserCertification } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LifecycleEmailService } from './lifecycle-email.service'
import {
  createLifecycleEmailAcceptanceHarness,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

describe('POST /api/v1/user-certifications/:id/exam-outcome (integration)', () => {
  let harness: LifecycleEmailAcceptanceHarness
  let service: LifecycleEmailService
  let em: EntityManager

  beforeAll(async () => {
    harness = await createLifecycleEmailAcceptanceHarness()
    service = harness.moduleRef.get(LifecycleEmailService)
    em = harness.moduleRef.get(EntityManager)
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  const req = () => harness.getRequest()

  async function seedExamReadyEnrollment(email: string): Promise<{
    token: string
    userId: string
    enrollmentId: string
  }> {
    const token = await harness.registerAndLogin(email, 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification(`CLF-${Math.random().toString(36).slice(2, 8)}`)
    const enrollmentId = await harness.enroll(token, cert.id)
    const cloudChunk = await harness.seedChunk(cert.id, 'Cloud Concepts')
    const securityChunk = await harness.seedChunk(cert.id, 'Security')

    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, cloudChunk, true, 5)
      await harness.seedQuizResponse(enrollmentId, securityChunk, true, 5)
    }
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, 95)

    return { token, userId, enrollmentId }
  }

  function nudgesFor(email: string) {
    return harness.capturedMail().filter((m) => m.to === email && /exam/i.test(m.subject))
  }

  async function readReadiness(token: string, enrollmentId: string): Promise<number | null> {
    const res = await req()
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${token}`)
    return res.body.data.score as number | null
  }

  it('records an outcome for the owner with a response timestamp', async () => {
    const { token, enrollmentId } = await seedExamReadyEnrollment('outcome-owner@example.com')

    const res = await req()
      .post(`/api/v1/user-certifications/${enrollmentId}/exam-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'passed' })

    expect(res.status).toBe(200)
    expect(res.body.data.response).toBe('passed')

    const enrollment = await em.fork().findOneOrFail(UserCertification, { id: enrollmentId })
    expect(enrollment.examOutcomeResponse).toBe('passed')
    expect(enrollment.examOutcomeRespondedAt).not.toBeNull()
    // The response timestamp is the exact instant persisted, not a second clock read.
    expect(res.body.data.respondedAt).toBe(enrollment.examOutcomeRespondedAt?.toISOString())
  })

  it('does not change the readiness score', async () => {
    const { token, enrollmentId } = await seedExamReadyEnrollment('outcome-readiness@example.com')

    const before = await readReadiness(token, enrollmentId)

    await req()
      .post(`/api/v1/user-certifications/${enrollmentId}/exam-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'did_not_pass' })

    const after = await readReadiness(token, enrollmentId)
    expect(after).toBe(before)
  })

  it('returns 404 for a non-owner and records no state', async () => {
    const { enrollmentId } = await seedExamReadyEnrollment('outcome-victim@example.com')
    const otherToken = await harness.registerAndLogin(
      'outcome-attacker@example.com',
      'correcthorse',
    )

    const res = await req()
      .post(`/api/v1/user-certifications/${enrollmentId}/exam-outcome`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ response: 'passed' })

    expect(res.status).toBe(404)

    const enrollment = await em.fork().findOneOrFail(UserCertification, { id: enrollmentId })
    expect(enrollment.examOutcomeResponse).toBeNull()
    expect(enrollment.examOutcomeRespondedAt).toBeNull()
  })

  it('stops further nudges once an outcome is recorded', async () => {
    const email = 'outcome-stops-nudge@example.com'
    const { token, enrollmentId } = await seedExamReadyEnrollment(email)

    const res = await req()
      .post(`/api/v1/user-certifications/${enrollmentId}/exam-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'passed' })
    expect(res.status).toBe(200)

    await service.maybeSendNudge(enrollmentId, new Date('2026-06-29T12:00:00Z'))

    expect(nudgesFor(email)).toHaveLength(0)
  })
})
