export type ReadinessTrajectory = {
  weeksToReady: number
}

export type ReadinessResult =
  | { calibrated: true; score: number; trajectory: ReadinessTrajectory | null }
  | { calibrated: false; score: null; trajectory: null }

export type CalibrationInput = {
  gradedAnswerCount: number
  hasCompletedDiagnostic: boolean
  threshold: number
}

export function isCalibrated({
  gradedAnswerCount,
  hasCompletedDiagnostic,
  threshold,
}: CalibrationInput): boolean {
  return hasCompletedDiagnostic || gradedAnswerCount >= threshold
}
