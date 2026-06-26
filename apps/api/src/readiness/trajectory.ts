import type { ReadinessTrajectory } from './calibration'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

const DEFAULT_MIN_HISTORY_POINTS = 3
const DEFAULT_TARGET_SCORE = 80

export type ReadinessHistoryPoint = {
  at: Date
  score: number
}

export type TrajectoryOptions = {
  minHistoryPoints?: number
  targetScore?: number
}

// Least-squares slope of score over time, expressed in points-per-week.
function slopePerWeek(points: ReadinessHistoryPoint[]): number {
  const origin = points[0]!.at.getTime()
  const xs = points.map((p) => (p.at.getTime() - origin) / MS_PER_WEEK)
  const ys = points.map((p) => p.score)
  const n = points.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    numerator += dx * (ys[i]! - meanY)
    denominator += dx * dx
  }

  if (denominator === 0) return 0
  return numerator / denominator
}

export function estimateTrajectory(
  history: ReadinessHistoryPoint[],
  options: TrajectoryOptions = {},
): ReadinessTrajectory | null {
  const minHistoryPoints = options.minHistoryPoints ?? DEFAULT_MIN_HISTORY_POINTS
  const targetScore = options.targetScore ?? DEFAULT_TARGET_SCORE

  if (history.length < minHistoryPoints) return null

  const slope = slopePerWeek(history)
  if (slope <= 0) return null

  const latestScore = history[history.length - 1]!.score
  if (latestScore >= targetScore) return { weeksToReady: 0 }

  return { weeksToReady: Math.ceil((targetScore - latestScore) / slope) }
}
