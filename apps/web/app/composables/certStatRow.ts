import { pluralizeUnit } from '~/composables/paceFormatter'
import { formatReadiness } from '~/composables/readinessFormat'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'
import type { CardReadiness } from '~/composables/useCardReadiness'

export interface CertStatRow {
  readinessLabel: string
  trajectoryLabel: string | null
  totalSessions: number
  dueCount: number
  questionsAnswered: number
  accuracyLabel: string | null
  accuracyColorClass: string | null
}

export function formatCertStatRow(input: {
  readiness: CardReadiness
  totalSessions: number
  dueCount: number
  questionsAnswered: number
  accuracy: number | null
}): CertStatRow {
  const display = formatReadiness(input.readiness, null)
  const { trajectory } = input.readiness

  // A 0% accuracy is only meaningful once at least one question has been answered.
  const accuracyPercent =
    input.accuracy === null || input.questionsAnswered === 0
      ? null
      : Math.round(input.accuracy * 100)

  return {
    readinessLabel: display.percent ?? display.label ?? 'not yet calibrated',
    trajectoryLabel: trajectory
      ? `exam-ready in ~${trajectory.weeksToReady} ${pluralizeUnit(trajectory.weeksToReady, 'week')}`
      : null,
    totalSessions: input.totalSessions,
    dueCount: input.dueCount,
    questionsAnswered: input.questionsAnswered,
    accuracyLabel: accuracyPercent === null ? null : `${accuracyPercent}%`,
    accuracyColorClass:
      accuracyPercent === null ? null : statusTextColorClass(statusColorForScore(accuracyPercent)),
  }
}
