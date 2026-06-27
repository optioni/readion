import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createLifecycleEmailAcceptanceHarness,
  INTERNAL_API_SECRET,
  INTERNAL_SECRET_HEADER,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

// Outer-loop acceptance test for the email-lifecycle change: it exercises the welcome
// send, the internal digest/nudge endpoints, the public unsubscribe and exam-outcome
// routes, and the digest/exam-nudge templates end-to-end against real Postgres + Redis.

const DIGEST_ENDPOINT = '/internal/lifecycle/digest'
const NUDGE_ENDPOINT = '/internal/lifecycle/nudge'
const UNSUBSCRIBE_ENDPOINT = '/api/v1/email/unsubscribe'

function findBySubject(
  messages: ReadonlyArray<{ subject: string }>,
  fragment: string,
): { subject: string; text: string; html: string; to: string } | undefined {
  return messages.find((m) => m.subject.toLowerCase().includes(fragment.toLowerCase())) as
    | { subject: string; text: string; html: string; to: string }
    | undefined
}

describe('email-lifecycle acceptance', () => {
  let harness: LifecycleEmailAcceptanceHarness

  beforeAll(async () => {
    harness = await createLifecycleEmailAcceptanceHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  const req = () => harness.getRequest()

  it('sends exactly one welcome email on successful registration', async () => {
    await harness.registerAndLogin('newcomer@example.com', 'correcthorse')

    const welcomeEmails = harness
      .capturedMail()
      .filter((m) => m.to === 'newcomer@example.com' && m.subject.toLowerCase().includes('welcome'))

    expect(welcomeEmails).toHaveLength(1)
    expect(welcomeEmails[0]?.html).toContain('<html')
  })

  it('assembles and sends a weekly digest, and the unsubscribe link opts the user out', async () => {
    const token = await harness.registerAndLogin('digest@example.com', 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification('CLF-DIGEST')
    const enrollmentId = await harness.enroll(token, cert.id)
    const cloudChunk = await harness.seedChunk(cert.id, 'Cloud Concepts')
    const securityChunk = await harness.seedChunk(cert.id, 'Security')

    // Strong in Cloud Concepts, weak in Security -> Security is the weakest domain.
    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, cloudChunk, true, 4)
    }
    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, securityChunk, false, 2)
    }
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, 60)
    await harness.seedDueReviewItem(enrollmentId, securityChunk, new Date(Date.now() - 86_400_000))

    const digestRes = await req()
      .post(DIGEST_ENDPOINT)
      .set(INTERNAL_SECRET_HEADER, INTERNAL_API_SECRET)
      .send({ userIds: [userId] })

    expect(digestRes.status).toBeLessThan(300)

    const digest = findBySubject(harness.capturedMail(), 'progress')
    expect(digest).toBeDefined()
    expect(digest?.to).toBe('digest@example.com')
    expect(digest?.text).toContain('%')
    expect(digest?.text.toLowerCase()).toContain('security')
    expect(digest?.text.toLowerCase()).toContain('unsubscribe')

    const unsubscribeMatch = digest?.text.match(
      new RegExp(`${UNSUBSCRIBE_ENDPOINT}\\?token=([\\w.-]+)`),
    )
    expect(unsubscribeMatch).not.toBeNull()
    const token2 = unsubscribeMatch?.[1] ?? ''

    const unsubscribeRes = await req().get(`${UNSUBSCRIBE_ENDPOINT}?token=${token2}`)
    expect(unsubscribeRes.status).toBe(200)

    // After opting out, re-triggering the digest must not send another digest email.
    harness.clearCapturedMail()
    const secondRun = await req()
      .post(DIGEST_ENDPOINT)
      .set(INTERNAL_SECRET_HEADER, INTERNAL_API_SECRET)
      .send({ userIds: [userId] })
    expect(secondRun.status).toBeLessThan(300)
    expect(findBySubject(harness.capturedMail(), 'progress')).toBeUndefined()
  })

  it('nudges an exam-ready, lulled enrollment and records the exam outcome without changing readiness', async () => {
    const token = await harness.registerAndLogin('nudge@example.com', 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification('CLF-NUDGE')
    const enrollmentId = await harness.enroll(token, cert.id)
    const cloudChunk = await harness.seedChunk(cert.id, 'Cloud Concepts')
    const securityChunk = await harness.seedChunk(cert.id, 'Security')

    for (let i = 0; i < 10; i += 1) {
      await harness.seedQuizResponse(enrollmentId, cloudChunk, true, 5)
      await harness.seedQuizResponse(enrollmentId, securityChunk, true, 5)
    }
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, 90)

    const readinessBefore = await req()
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${token}`)
    expect(readinessBefore.status).toBe(200)
    const scoreBefore = readinessBefore.body.data.score as number | null

    const nudgeRes = await req()
      .post(NUDGE_ENDPOINT)
      .set(INTERNAL_SECRET_HEADER, INTERNAL_API_SECRET)
      .send({ userCertificationIds: [enrollmentId] })
    expect(nudgeRes.status).toBeLessThan(300)

    const survey = findBySubject(harness.capturedMail(), 'exam')
    expect(survey).toBeDefined()
    expect(survey?.to).toBe('nudge@example.com')
    expect(survey?.text.toLowerCase()).toContain('did you take the exam')

    const outcomeRes = await req()
      .post(`/api/v1/user-certifications/${enrollmentId}/exam-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'passed' })
    expect(outcomeRes.status).toBeLessThan(300)

    const readinessAfter = await req()
      .get(`/api/v1/user-certifications/${enrollmentId}/readiness`)
      .set('Authorization', `Bearer ${token}`)
    expect(readinessAfter.body.data.score).toBe(scoreBefore)
  })
})
