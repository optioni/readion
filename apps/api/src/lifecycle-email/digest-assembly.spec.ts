import { describe, expect, it } from 'vitest'
import type { ReadinessResult } from '../readiness/calibration'
import type { WeakAreaDto } from '../weak-areas/weak-areas.service'
import {
  buildEnrollmentSection,
  computeWeeklyDelta,
  NO_WEAK_AREA_FALLBACK,
} from './digest-assembly'

const weakArea = (domain: string): WeakAreaDto => ({
  id: `wa-${domain}`,
  domain,
  score: 40,
  accuracy: 0.5,
  meanConfidence: 3,
  responseCount: 8,
})

const calibrated = (score: number): ReadinessResult => ({
  calibrated: true,
  score,
  trajectory: null,
})
const uncalibrated: ReadinessResult = { calibrated: false, score: null, trajectory: null }

describe('computeWeeklyDelta', () => {
  it('returns the difference from the snapshot', () => {
    expect(computeWeeklyDelta(68, 60)).toBe(8)
    expect(computeWeeklyDelta(55, 60)).toBe(-5)
  })

  it('returns null when there is no prior snapshot', () => {
    expect(computeWeeklyDelta(68, null)).toBeNull()
  })
})

describe('buildEnrollmentSection', () => {
  it('builds a calibrated section with delta, weakest domain and due count', () => {
    const section = buildEnrollmentSection({
      certName: 'AWS CLF',
      readiness: calibrated(72),
      snapshot: 66,
      weakAreas: [weakArea('Security'), weakArea('Cloud Concepts')],
      dueReviewCount: 3,
    })

    expect(section).toEqual({
      certName: 'AWS CLF',
      calibrated: true,
      readiness: 72,
      delta: 6,
      weakestDomain: 'Security',
      dueReviewCount: 3,
    })
  })

  it('falls back to a generic focus area when there are no weak areas', () => {
    const section = buildEnrollmentSection({
      certName: 'AWS CLF',
      readiness: calibrated(72),
      snapshot: null,
      weakAreas: [],
      dueReviewCount: 0,
    })

    expect(section).toMatchObject({
      calibrated: true,
      delta: null,
      weakestDomain: NO_WEAK_AREA_FALLBACK,
    })
  })

  it('builds the keep-going variant for an uncalibrated enrollment', () => {
    const section = buildEnrollmentSection({
      certName: 'Azure',
      readiness: uncalibrated,
      snapshot: 50,
      weakAreas: [],
      dueReviewCount: 0,
    })

    expect(section).toEqual({ certName: 'Azure', calibrated: false })
  })
})
