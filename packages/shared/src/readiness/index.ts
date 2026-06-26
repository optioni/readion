export const READINESS_CALIBRATION_MIN_ANSWERS_DEFAULT = 10

export interface ReadinessTrajectory {
  weeksToReady: number
}

export type ReadinessResponse =
  | { calibrated: true; score: number; trajectory: ReadinessTrajectory | null }
  | { calibrated: false; score: null; trajectory: null }
