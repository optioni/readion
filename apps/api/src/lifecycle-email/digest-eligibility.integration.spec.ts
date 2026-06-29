import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LifecycleEmailService } from './lifecycle-email.service'
import {
  createLifecycleEmailAcceptanceHarness,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

// Regression guard: the authenticated Settings writer (`PATCH /users/me { digestOptOut }`)
// and the tokenized unsubscribe link converge on the same `User.digestOptOut` field, so the
// weekly-digest selection path must honor whatever the authenticated writer last persisted.
describe('Digest eligibility after authenticated opt-out/in (integration)', () => {
  let harness: LifecycleEmailAcceptanceHarness
  let service: LifecycleEmailService

  beforeAll(async () => {
    harness = await createLifecycleEmailAcceptanceHarness()
    service = harness.moduleRef.get(LifecycleEmailService)
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function capturedDigestsFor(email: string) {
    return harness
      .capturedMail()
      .filter((m) => m.to === email && m.subject.toLowerCase().includes('progress'))
  }

  it('skips the digest after an authenticated opt-out and resumes it after an authenticated opt-in', async () => {
    const email = 'digest-eligibility@example.com'
    const token = await harness.registerAndLogin(email, 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification(`CLF-${Math.random().toString(36).slice(2, 8)}`)
    await harness.enroll(token, cert.id)

    await harness
      .getRequest()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ digestOptOut: true })
      .expect(200)

    await service.sendDigest(userId)
    expect(capturedDigestsFor(email)).toHaveLength(0)

    await harness
      .getRequest()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ digestOptOut: false })
      .expect(200)

    await service.sendDigest(userId)
    expect(capturedDigestsFor(email)).toHaveLength(1)
  })
})
