import { EntityManager } from '@mikro-orm/core'
import { UserCertification } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LifecycleEmailService } from './lifecycle-email.service'
import {
  createLifecycleEmailAcceptanceHarness,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

const MS_PER_DAY = 24 * 60 * 60 * 1000

describe('LifecycleEmailService.maybeSendNudge (integration)', () => {
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

  async function seedEnrollment(email: string, outcome: 'ready' | 'unready'): Promise<string> {
    const token = await harness.registerAndLogin(email, 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification(`CLF-${Math.random().toString(36).slice(2, 8)}`)
    const enrollmentId = await harness.enroll(token, cert.id)
    const cloudChunk = await harness.seedChunk(cert.id, 'Cloud Concepts')
    const securityChunk = await harness.seedChunk(cert.id, 'Security')

    const correct = outcome === 'ready'
    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, cloudChunk, correct, 5)
      await harness.seedQuizResponse(enrollmentId, securityChunk, correct, 5)
    }
    // Submitted diagnostic calibrates the enrollment regardless of answer volume.
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, correct ? 95 : 30)

    return enrollmentId
  }

  function nudgesFor(email: string) {
    return harness.capturedMail().filter((m) => m.to === email && /exam/i.test(m.subject))
  }

  async function patchEnrollment(
    enrollmentId: string,
    fields: Partial<{
      examOutcomeResponse: string
      examOutcomeNudgeCount: number
      examOutcomeNudgeSentAt: Date
    }>,
  ): Promise<void> {
    const fork = em.fork()
    const enrollment = await fork.findOneOrFail(UserCertification, { id: enrollmentId })
    Object.assign(enrollment, fields)
    await fork.flush()
  }

  it('sends and records an exam-nudge for a calibrated, exam-ready enrollment', async () => {
    const email = 'nudge-ready@example.com'
    const enrollmentId = await seedEnrollment(email, 'ready')
    const now = new Date('2026-06-29T12:00:00Z')

    await service.maybeSendNudge(enrollmentId, now)

    const nudges = nudgesFor(email)
    expect(nudges).toHaveLength(1)
    expect(`${nudges[0]!.subject} ${nudges[0]!.text}`).toMatch(/exam|passed|survey|outcome/i)
    expect(`${nudges[0]!.text} ${nudges[0]!.html}`).toMatch(/passed/i)

    const enrollment = await em.fork().findOneOrFail(UserCertification, { id: enrollmentId })
    expect(enrollment.examOutcomeNudgeCount).toBe(1)
    expect(enrollment.examOutcomeNudgeSentAt).not.toBeNull()
  })

  it('does not nudge a calibrated but not-exam-ready enrollment', async () => {
    const email = 'nudge-unready@example.com'
    const enrollmentId = await seedEnrollment(email, 'unready')

    await service.maybeSendNudge(enrollmentId, new Date('2026-06-29T12:00:00Z'))

    expect(nudgesFor(email)).toHaveLength(0)
  })

  it('does not nudge once a response has been recorded', async () => {
    const email = 'nudge-responded@example.com'
    const enrollmentId = await seedEnrollment(email, 'ready')
    await patchEnrollment(enrollmentId, { examOutcomeResponse: 'dismissed' })

    await service.maybeSendNudge(enrollmentId, new Date('2026-06-29T12:00:00Z'))

    expect(nudgesFor(email)).toHaveLength(0)
  })

  it('sends exactly one follow-up after the delay and never a third nudge', async () => {
    const email = 'nudge-followup@example.com'
    const enrollmentId = await seedEnrollment(email, 'ready')
    const now = new Date('2026-06-29T12:00:00Z')

    await patchEnrollment(enrollmentId, {
      examOutcomeNudgeCount: 1,
      examOutcomeNudgeSentAt: new Date(now.getTime() - 4 * MS_PER_DAY),
    })
    await service.maybeSendNudge(enrollmentId, now)
    expect(nudgesFor(email)).toHaveLength(1)

    const afterFollowup = await em.fork().findOneOrFail(UserCertification, { id: enrollmentId })
    expect(afterFollowup.examOutcomeNudgeCount).toBe(2)

    // A later run must not produce a third nudge.
    await service.maybeSendNudge(enrollmentId, new Date(now.getTime() + 10 * MS_PER_DAY))
    expect(nudgesFor(email)).toHaveLength(1)
  })
})
