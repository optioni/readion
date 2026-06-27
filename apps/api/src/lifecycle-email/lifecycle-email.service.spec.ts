import type { EntityManager } from '@mikro-orm/core'
import type { ConfigService } from '@nestjs/config'
import type { Counter } from 'prom-client'
import { describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import type { ReadinessResult } from '../readiness/calibration'
import type { ReadinessService } from '../readiness/readiness.service'
import type { ReviewService } from '../review/review.service'
import type { WeakAreaDto, WeakAreasService } from '../weak-areas/weak-areas.service'
import { type DigestEnrollmentInput, LifecycleEmailService } from './lifecycle-email.service'

const UNSUBSCRIBE_URL = 'http://localhost:3001/api/v1/email/unsubscribe?token=abc'

const calibrated = (score: number): ReadinessResult => ({
  calibrated: true,
  score,
  trajectory: null,
})

const uncalibrated = (): ReadinessResult => ({ calibrated: false, score: null, trajectory: null })

const weakArea = (domain: string, score: number, responseCount: number): WeakAreaDto => ({
  id: `wa-${domain}`,
  domain,
  score,
  accuracy: 0.5,
  meanConfidence: 3,
  responseCount,
})

type ReadinessByEnrollment = Record<string, ReadinessResult>
type WeakAreasByEnrollment = Record<string, WeakAreaDto[]>
type DueCountByEnrollment = Record<string, number>

function buildService(maps: {
  readiness: ReadinessByEnrollment
  weakAreas: WeakAreasByEnrollment
  dueCounts: DueCountByEnrollment
}): LifecycleEmailService {
  const readiness = {
    compute: vi.fn(async (enrollmentId: string) => maps.readiness[enrollmentId]),
  } as unknown as ReadinessService
  const weakAreas = {
    listForEnrollment: vi.fn(
      async (_userId: string, enrollmentId: string) => maps.weakAreas[enrollmentId] ?? [],
    ),
  } as unknown as WeakAreasService
  const review = {
    getQueue: vi.fn(async (_userId: string, enrollmentId: string) => ({
      items: [],
      meta: { dueCount: maps.dueCounts[enrollmentId] ?? 0, total: 0 },
    })),
  } as unknown as ReviewService

  return new LifecycleEmailService(
    {} as EntityManager,
    readiness,
    weakAreas,
    review,
    {} as ConfiguredMailService,
    {} as ConfigService<EnvConfig>,
    { inc: vi.fn() } as unknown as Counter,
  )
}

describe('LifecycleEmailService.assembleDigest', () => {
  const userId = 'user-1'

  it('renders a calibrated enrollment with readiness, delta, weakest domain and due count', async () => {
    const service = buildService({
      readiness: { 'enr-1': calibrated(72) },
      weakAreas: {
        'enr-1': [weakArea('Security', 40, 8), weakArea('Cloud Concepts', 80, 8)],
      },
      dueCounts: { 'enr-1': 3 },
    })

    const enrollments: DigestEnrollmentInput[] = [
      { id: 'enr-1', certName: 'AWS CLF', snapshot: 66 },
    ]

    const payload = await service.assembleDigest(userId, UNSUBSCRIBE_URL, enrollments)

    expect(payload.unsubscribeUrl).toBe(UNSUBSCRIBE_URL)
    expect(payload.enrollments).toHaveLength(1)
    const section = payload.enrollments[0]
    expect(section).toMatchObject({
      certName: 'AWS CLF',
      calibrated: true,
      readiness: 72,
      delta: 6,
      weakestDomain: 'Security',
      dueReviewCount: 3,
    })
  })

  it('omits the delta for the first digest (no prior snapshot)', async () => {
    const service = buildService({
      readiness: { 'enr-1': calibrated(68) },
      weakAreas: { 'enr-1': [weakArea('Security', 40, 8)] },
      dueCounts: { 'enr-1': 0 },
    })

    const payload = await service.assembleDigest(userId, UNSUBSCRIBE_URL, [
      { id: 'enr-1', certName: 'AWS CLF', snapshot: null },
    ])

    const section = payload.enrollments[0]
    expect(section?.calibrated).toBe(true)
    if (section?.calibrated) {
      expect(section.delta).toBeNull()
      expect(section.readiness).toBe(68)
    }
  })

  it('renders an uncalibrated enrollment as the keep-going variant with no delta', async () => {
    const service = buildService({
      readiness: { 'enr-1': uncalibrated() },
      weakAreas: {},
      dueCounts: {},
    })

    const payload = await service.assembleDigest(userId, UNSUBSCRIBE_URL, [
      { id: 'enr-1', certName: 'AWS CLF', snapshot: null },
    ])

    const section = payload.enrollments[0]
    expect(section).toEqual({ certName: 'AWS CLF', calibrated: false })
  })

  it('produces one section per active enrollment', async () => {
    const service = buildService({
      readiness: { 'enr-1': calibrated(72), 'enr-2': uncalibrated() },
      weakAreas: { 'enr-1': [weakArea('Security', 40, 8)] },
      dueCounts: { 'enr-1': 2 },
    })

    const payload = await service.assembleDigest(userId, UNSUBSCRIBE_URL, [
      { id: 'enr-1', certName: 'AWS CLF', snapshot: 70 },
      { id: 'enr-2', certName: 'Azure', snapshot: null },
    ])

    expect(payload.enrollments).toHaveLength(2)
    expect(payload.enrollments[0]).toMatchObject({ calibrated: true, delta: 2 })
    expect(payload.enrollments[1]).toEqual({ certName: 'Azure', calibrated: false })
  })
})
