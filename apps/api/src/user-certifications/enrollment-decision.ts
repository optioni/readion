import type { EnrollmentStatus } from '@readion/shared'

export type EnrollmentDecision = 'create' | 'restore' | 'conflict'

export function resolveEnrollmentDecision(
  existingStatus: EnrollmentStatus | null,
): EnrollmentDecision {
  if (existingStatus === null) return 'create'
  if (existingStatus === 'archived') return 'restore'
  return 'conflict'
}
