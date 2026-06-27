import type { DigestEnrollmentSection } from '../mail/templates'
import type { ReadinessResult } from '../readiness/calibration'
import type { WeakAreaDto } from '../weak-areas/weak-areas.service'

export const NO_WEAK_AREA_FALLBACK = 'your recent topics'

export function computeWeeklyDelta(current: number, snapshot: number | null): number | null {
  return snapshot === null ? null : current - snapshot
}

export function buildEnrollmentSection(input: {
  certName: string
  readiness: ReadinessResult
  snapshot: number | null
  weakAreas: WeakAreaDto[]
  dueReviewCount: number
}): DigestEnrollmentSection {
  if (!input.readiness.calibrated) {
    return { certName: input.certName, calibrated: false }
  }
  return {
    certName: input.certName,
    calibrated: true,
    readiness: input.readiness.score,
    delta: computeWeeklyDelta(input.readiness.score, input.snapshot),
    weakestDomain: input.weakAreas[0]?.domain ?? NO_WEAK_AREA_FALLBACK,
    dueReviewCount: input.dueReviewCount,
  }
}
