import { formatReadiness } from '~/composables/readinessFormat'
import type { CardReadiness } from '~/composables/useCardReadiness'

export interface CertStatRow {
  readinessLabel: string
  trajectoryLabel: string | null
  totalSessions: number
  dueCount: number
}

export function formatCertStatRow(input: {
  readiness: CardReadiness
  totalSessions: number
  dueCount: number
}): CertStatRow {
  const display = formatReadiness(input.readiness, null)
  const { trajectory } = input.readiness

  return {
    readinessLabel: display.percent ?? display.label ?? 'not yet calibrated',
    trajectoryLabel: trajectory ? `exam-ready in ~${trajectory.weeksToReady} weeks` : null,
    totalSessions: input.totalSessions,
    dueCount: input.dueCount,
  }
}
