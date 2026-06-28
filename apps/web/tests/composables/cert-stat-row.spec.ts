import { describe, expect, it } from 'vitest'
import { formatCertStatRow } from '~/composables/certStatRow'
import type { CardReadiness } from '~/composables/useCardReadiness'

const readiness = (overrides: Partial<CardReadiness>): CardReadiness => ({
  calibrated: true,
  score: 75,
  trajectory: null,
  ...overrides,
})

describe('formatCertStatRow', () => {
  it('shows the readiness percentage when calibrated', () => {
    const row = formatCertStatRow({
      readiness: readiness({ calibrated: true, score: 72 }),
      totalSessions: 4,
      dueCount: 2,
    })
    expect(row.readinessLabel).toBe('72%')
  })

  it('shows "not yet calibrated" with no percentage when uncalibrated', () => {
    const row = formatCertStatRow({
      readiness: readiness({ calibrated: false, score: null }),
      totalSessions: 0,
      dueCount: 0,
    })
    expect(row.readinessLabel).toBe('not yet calibrated')
    expect(row.readinessLabel).not.toContain('%')
  })

  it('adds the trajectory line only when a trajectory is present', () => {
    const withTrajectory = formatCertStatRow({
      readiness: readiness({ trajectory: { weeksToReady: 6 } }),
      totalSessions: 3,
      dueCount: 1,
    })
    expect(withTrajectory.trajectoryLabel).toBe('exam-ready in ~6 weeks')

    const withoutTrajectory = formatCertStatRow({
      readiness: readiness({ trajectory: null }),
      totalSessions: 3,
      dueCount: 1,
    })
    expect(withoutTrajectory.trajectoryLabel).toBeNull()
  })

  it('passes through the total-sessions and due-review counts', () => {
    const row = formatCertStatRow({
      readiness: readiness({}),
      totalSessions: 9,
      dueCount: 5,
    })
    expect(row.totalSessions).toBe(9)
    expect(row.dueCount).toBe(5)
  })
})
