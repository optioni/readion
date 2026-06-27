import { EntityManager } from '@mikro-orm/core'
import { User, UserCertification } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LifecycleEmailService } from './lifecycle-email.service'
import {
  createLifecycleEmailAcceptanceHarness,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

const UNSUBSCRIBE_PATH = '/api/v1/email/unsubscribe'

describe('LifecycleEmailService.sendDigest (integration)', () => {
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

  async function seedCalibratedEnrollment(email: string): Promise<{
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
      await harness.seedQuizResponse(enrollmentId, cloudChunk, true, 4)
    }
    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, securityChunk, false, 2)
    }
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, 60)
    await harness.seedDueReviewItem(enrollmentId, securityChunk, new Date(Date.now() - 86_400_000))

    return { userId, enrollmentId }
  }

  it('sends one digest with all four metrics, an unsubscribe link, and persists the snapshot', async () => {
    const { userId, enrollmentId } = await seedCalibratedEnrollment('digest-int@example.com')

    await service.sendDigest(userId)

    const digests = harness
      .capturedMail()
      .filter(
        (m) => m.to === 'digest-int@example.com' && m.subject.toLowerCase().includes('progress'),
      )
    expect(digests).toHaveLength(1)

    const digest = digests[0]!
    expect(digest.text).toContain('%')
    expect(digest.text.toLowerCase()).toContain('security')
    expect(digest.text).toContain('1 review item')
    expect(digest.text.toLowerCase()).toContain('unsubscribe')
    expect(digest.text).toMatch(new RegExp(`${UNSUBSCRIBE_PATH}\\?token=[\\w.-]+`))
    expect(digest.html).toContain('<html')

    const fork = em.fork()
    const user = await fork.findOneOrFail(User, { id: userId })
    expect(user.lastDigestSentAt).not.toBeNull()
    expect(user.unsubscribeToken).not.toBeNull()

    const enrollment = await fork.findOneOrFail(UserCertification, { id: enrollmentId })
    expect(enrollment.lastDigestReadiness).not.toBeNull()
    expect(typeof enrollment.lastDigestReadiness).toBe('number')
  })

  it('computes the weekly delta from the prior snapshot on the second send', async () => {
    const { userId, enrollmentId } = await seedCalibratedEnrollment('digest-delta@example.com')

    await service.sendDigest(userId)

    const firstFork = em.fork()
    const afterFirst = await firstFork.findOneOrFail(UserCertification, { id: enrollmentId })
    const snapshot = afterFirst.lastDigestReadiness
    expect(snapshot).not.toBeNull()

    await service.sendDigest(userId)

    const digests = harness
      .capturedMail()
      .filter(
        (m) =>
          m.to === 'digest-delta@example.com' && m.subject.toLowerCase().includes('progress'),
      )
    expect(digests).toHaveLength(2)
    expect(digests[1]!.text).toContain('from last week')
  })
})
