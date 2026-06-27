import type { EntityManager } from '@mikro-orm/core'
import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import type { ReadinessResult } from '../readiness/calibration'
import type { ReadinessService } from '../readiness/readiness.service'
import type { ReviewService } from '../review/review.service'
import type { WeakAreasService } from '../weak-areas/weak-areas.service'
import { LifecycleEmailService } from './lifecycle-email.service'

const ENROLLMENT_ID = 'enr-1'
const NOW = new Date('2026-06-29T12:00:00Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000

const CONFIG: Record<string, number> = {
  EXAM_READY_THRESHOLD: 75,
  NUDGE_MAX_FOLLOWUPS: 1,
  NUDGE_FOLLOWUP_DELAY_DAYS: 3,
}

const calibrated = (score: number): ReadinessResult => ({
  calibrated: true,
  score,
  trajectory: null,
})
const uncalibrated = (): ReadinessResult => ({ calibrated: false, score: null, trajectory: null })

type FakeEnrollment = {
  id: string
  user: { email: string }
  certification: { name: string }
  examOutcomeResponse: string | null
  examOutcomeNudgeCount: number
  examOutcomeNudgeSentAt: Date | null
}

function buildEnrollment(overrides: Partial<FakeEnrollment> = {}): FakeEnrollment {
  return {
    id: ENROLLMENT_ID,
    user: { email: 'learner@example.com' },
    certification: { name: 'AWS CLF' },
    examOutcomeResponse: null,
    examOutcomeNudgeCount: 0,
    examOutcomeNudgeSentAt: null,
    ...overrides,
  }
}

function buildService(opts: { enrollment: FakeEnrollment | null; readiness: ReadinessResult }): {
  service: LifecycleEmailService
  send: ReturnType<typeof vi.fn>
  compute: ReturnType<typeof vi.fn>
  flush: ReturnType<typeof vi.fn>
} {
  const flush = vi.fn(async () => {})
  const fork = {
    findOne: vi.fn(async () => opts.enrollment),
    flush,
  }
  const em = { fork: () => fork } as unknown as EntityManager

  const compute = vi.fn(async () => opts.readiness)
  const readiness = { compute } as unknown as ReadinessService
  const send = vi.fn(async () => {})
  const mail = { send } as unknown as ConfiguredMailService
  const config = {
    get: (key: string) => CONFIG[key],
    getOrThrow: (key: string) => CONFIG[key],
  } as unknown as ConfigService<EnvConfig>

  const service = new LifecycleEmailService(
    em,
    readiness,
    {} as WeakAreasService,
    {} as ReviewService,
    mail,
    config,
  )

  return { service, send, compute, flush }
}

describe('LifecycleEmailService.maybeSendNudge', () => {
  it('sends and records the first nudge for a calibrated, exam-ready enrollment', async () => {
    const enrollment = buildEnrollment()
    const { service, send } = buildService({ enrollment, readiness: calibrated(90) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).toHaveBeenCalledTimes(1)
    const [template, to] = send.mock.calls[0]!
    expect(template).toBe('exam-nudge')
    expect(to).toBe('learner@example.com')
    expect(enrollment.examOutcomeNudgeCount).toBe(1)
    expect(enrollment.examOutcomeNudgeSentAt).toEqual(NOW)
  })

  it('does not send when readiness is below the exam-ready threshold', async () => {
    const enrollment = buildEnrollment()
    const { service, send } = buildService({ enrollment, readiness: calibrated(50) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).not.toHaveBeenCalled()
    expect(enrollment.examOutcomeNudgeCount).toBe(0)
    expect(enrollment.examOutcomeNudgeSentAt).toBeNull()
  })

  it('does not send when the enrollment is not calibrated', async () => {
    const enrollment = buildEnrollment()
    const { service, send } = buildService({ enrollment, readiness: uncalibrated() })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).not.toHaveBeenCalled()
  })

  it('does not send once any response is recorded, including a dismissal', async () => {
    const enrollment = buildEnrollment({ examOutcomeResponse: 'dismissed' })
    const { service, send, compute } = buildService({ enrollment, readiness: calibrated(90) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).not.toHaveBeenCalled()
    expect(compute).not.toHaveBeenCalled()
  })

  it('sends a follow-up after the delay has elapsed since the first nudge', async () => {
    const enrollment = buildEnrollment({
      examOutcomeNudgeCount: 1,
      examOutcomeNudgeSentAt: new Date(NOW.getTime() - 4 * MS_PER_DAY),
    })
    const { service, send } = buildService({ enrollment, readiness: calibrated(90) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).toHaveBeenCalledTimes(1)
    expect(enrollment.examOutcomeNudgeCount).toBe(2)
    expect(enrollment.examOutcomeNudgeSentAt).toEqual(NOW)
  })

  it('does not send a follow-up before the delay has elapsed', async () => {
    const enrollment = buildEnrollment({
      examOutcomeNudgeCount: 1,
      examOutcomeNudgeSentAt: new Date(NOW.getTime() - 2 * MS_PER_DAY),
    })
    const { service, send } = buildService({ enrollment, readiness: calibrated(90) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).not.toHaveBeenCalled()
    expect(enrollment.examOutcomeNudgeCount).toBe(1)
  })

  it('never sends beyond the first nudge plus the maximum follow-ups', async () => {
    const enrollment = buildEnrollment({
      examOutcomeNudgeCount: 2,
      examOutcomeNudgeSentAt: new Date(NOW.getTime() - 30 * MS_PER_DAY),
    })
    const { service, send } = buildService({ enrollment, readiness: calibrated(90) })

    await service.maybeSendNudge(ENROLLMENT_ID, NOW)

    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing when the enrollment cannot be found', async () => {
    const { service, send } = buildService({ enrollment: null, readiness: calibrated(90) })

    await expect(service.maybeSendNudge(ENROLLMENT_ID, NOW)).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
  })
})
