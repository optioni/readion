import { describe, expect, it } from 'vitest'
import { selectHeroAndOrder } from '~/composables/dashboardOrdering'
import type { EnrollmentCard } from '~/composables/useEnrollments'

const makeCard = (
  overrides: Partial<EnrollmentCard> & { enrollmentId: string },
): EnrollmentCard => ({
  certificationId: `cert-${overrides.enrollmentId}`,
  name: 'Cert',
  provider: 'AWS',
  readinessScore: null,
  enrolledAt: '2026-01-01T00:00:00.000Z',
  status: 'active',
  ...overrides,
})

describe('selectHeroAndOrder', () => {
  it('returns no hero and empty rest for empty input', () => {
    expect(selectHeroAndOrder([])).toEqual({ hero: null, rest: [] })
  })

  it('sorts calibrated cards ascending and picks the lowest score as hero', () => {
    const a = makeCard({ enrollmentId: 'a', readinessScore: 75 })
    const b = makeCard({ enrollmentId: 'b', readinessScore: 42 })
    const c = makeCard({ enrollmentId: 'c', readinessScore: 88 })

    const result = selectHeroAndOrder([a, b, c])

    expect(result.hero).toBe(b)
    expect(result.rest).toEqual([a, c])
  })

  it('places uncalibrated cards after calibrated and never makes them hero on score', () => {
    const calibrated = makeCard({ enrollmentId: 'cal', readinessScore: 60 })
    const uncalibrated = makeCard({ enrollmentId: 'uncal', readinessScore: null })

    const result = selectHeroAndOrder([uncalibrated, calibrated])

    expect(result.hero).toBe(calibrated)
    expect(result.rest).toEqual([uncalibrated])
  })

  it('orders multiple uncalibrated cards most-recently-enrolled first after calibrated', () => {
    const calibrated = makeCard({ enrollmentId: 'cal', readinessScore: 55 })
    const older = makeCard({
      enrollmentId: 'older',
      readinessScore: null,
      enrolledAt: '2026-02-01T00:00:00.000Z',
    })
    const newer = makeCard({
      enrollmentId: 'newer',
      readinessScore: null,
      enrolledAt: '2026-05-01T00:00:00.000Z',
    })

    const result = selectHeroAndOrder([older, calibrated, newer])

    expect(result.hero).toBe(calibrated)
    expect(result.rest).toEqual([newer, older])
  })

  it('makes the most recently enrolled card the hero when none are calibrated', () => {
    const older = makeCard({
      enrollmentId: 'older',
      readinessScore: null,
      enrolledAt: '2026-02-01T00:00:00.000Z',
    })
    const newer = makeCard({
      enrollmentId: 'newer',
      readinessScore: null,
      enrolledAt: '2026-05-01T00:00:00.000Z',
    })
    const oldest = makeCard({
      enrollmentId: 'oldest',
      readinessScore: null,
      enrolledAt: '2026-01-01T00:00:00.000Z',
    })

    const result = selectHeroAndOrder([older, newer, oldest])

    expect(result.hero).toBe(newer)
    expect(result.rest).toEqual([older, oldest])
  })
})
