import type { DiagnosticOffer } from '@readion/shared'

export interface OfferParams {
  certLive: boolean
  hasCompletedDiagnostic: boolean
  completedSessionCount: number
  repromptAfterSessions: number
  diagnosticRePromptedAt: Date | null
}

export function deriveOffer(params: OfferParams): DiagnosticOffer {
  if (!params.certLive) return 'none'
  if (!params.hasCompletedDiagnostic) return 'onboarding'
  if (
    params.completedSessionCount >= params.repromptAfterSessions &&
    params.diagnosticRePromptedAt === null
  ) {
    return 're-prompt'
  }
  return 'none'
}
