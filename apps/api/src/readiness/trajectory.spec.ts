import { describe, expect, it } from 'vitest'
import { estimateTrajectory } from './trajectory'

const DAY = 24 * 60 * 60 * 1000
const start = new Date('2026-05-01T00:00:00.000Z')

function at(daysFromStart: number): Date {
  return new Date(start.getTime() + daysFromStart * DAY)
}

describe('estimateTrajectory', () => {
  it('returns null without enough history', () => {
    expect(estimateTrajectory([{ at: at(0), score: 40 }])).toBeNull()
    expect(
      estimateTrajectory([
        { at: at(0), score: 40 },
        { at: at(7), score: 45 },
      ]),
    ).toBeNull()
  })

  it('returns null when there is no positive trend', () => {
    const result = estimateTrajectory([
      { at: at(0), score: 60 },
      { at: at(7), score: 58 },
      { at: at(14), score: 55 },
    ])
    expect(result).toBeNull()
  })

  it('estimates weeks-to-ready once a positive trend exists over enough history', () => {
    const result = estimateTrajectory([
      { at: at(0), score: 40 },
      { at: at(7), score: 50 },
      { at: at(14), score: 60 },
    ])

    expect(result).not.toBeNull()
    expect(result?.weeksToReady).toBeGreaterThan(0)
    // Improving ~10 points/week from 60 toward an 80 target → ~2 weeks.
    expect(result?.weeksToReady).toBe(2)
  })

  it('returns zero weeks when already at or above the ready target', () => {
    const result = estimateTrajectory([
      { at: at(0), score: 75 },
      { at: at(7), score: 82 },
      { at: at(14), score: 90 },
    ])

    expect(result?.weeksToReady).toBe(0)
  })

  it('respects an explicit target threshold', () => {
    const result = estimateTrajectory(
      [
        { at: at(0), score: 40 },
        { at: at(7), score: 50 },
        { at: at(14), score: 60 },
      ],
      { targetScore: 70, minHistoryPoints: 3 },
    )

    expect(result?.weeksToReady).toBe(1)
  })
})
