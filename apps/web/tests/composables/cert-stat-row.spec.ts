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
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.readinessLabel).toBe('72%')
  })

  it('shows "not yet calibrated" with no percentage when uncalibrated', () => {
    const row = formatCertStatRow({
      readiness: readiness({ calibrated: false, score: null }),
      totalSessions: 0,
      dueCount: 0,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.readinessLabel).toBe('not yet calibrated')
    expect(row.readinessLabel).not.toContain('%')
  })

  it('adds the trajectory line only when a trajectory is present', () => {
    const withTrajectory = formatCertStatRow({
      readiness: readiness({ trajectory: { weeksToReady: 6 } }),
      totalSessions: 3,
      dueCount: 1,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(withTrajectory.trajectoryLabel).toBe('exam-ready in ~6 weeks')

    const withoutTrajectory = formatCertStatRow({
      readiness: readiness({ trajectory: null }),
      totalSessions: 3,
      dueCount: 1,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(withoutTrajectory.trajectoryLabel).toBeNull()
  })

  it('uses singular "week" when exactly one week to ready', () => {
    const row = formatCertStatRow({
      readiness: readiness({ trajectory: { weeksToReady: 1 } }),
      totalSessions: 3,
      dueCount: 1,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.trajectoryLabel).toBe('exam-ready in ~1 week')
  })

  it('uses plural "weeks" when more than one week to ready', () => {
    const row = formatCertStatRow({
      readiness: readiness({ trajectory: { weeksToReady: 3 } }),
      totalSessions: 3,
      dueCount: 1,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.trajectoryLabel).toBe('exam-ready in ~3 weeks')
  })

  it('passes through the total-sessions and due-review counts', () => {
    const row = formatCertStatRow({
      readiness: readiness({}),
      totalSessions: 9,
      dueCount: 5,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.totalSessions).toBe(9)
    expect(row.dueCount).toBe(5)
  })

  it('carries questions answered and a status-coloured accuracy label', () => {
    const row = formatCertStatRow({
      readiness: readiness({}),
      totalSessions: 3,
      dueCount: 1,
      questionsAnswered: 44,
      accuracy: 0.7233,
    })
    expect(row.questionsAnswered).toBe(44)
    expect(row.accuracyLabel).toBe('72%')
    expect(row.accuracyColorClass).toBe('text-readion-status-medium')
  })

  it('shows no accuracy label or colour when accuracy is null', () => {
    const row = formatCertStatRow({
      readiness: readiness({}),
      totalSessions: 0,
      dueCount: 0,
      questionsAnswered: 0,
      accuracy: null,
    })
    expect(row.questionsAnswered).toBe(0)
    expect(row.accuracyLabel).toBeNull()
    expect(row.accuracyColorClass).toBeNull()
  })

  it('suppresses accuracy label and colour when no questions have been answered, even with a non-null accuracy', () => {
    const row = formatCertStatRow({
      readiness: readiness({}),
      totalSessions: 0,
      dueCount: 0,
      questionsAnswered: 0,
      accuracy: 0,
    })
    expect(row.questionsAnswered).toBe(0)
    expect(row.accuracyLabel).toBeNull()
    expect(row.accuracyColorClass).toBeNull()
  })
})
