import type { CertificationDomain, CertificationFieldProvenance } from '@readion/shared'
import { buildProvenanceMap, validateDomainWeights } from '@readion/shared'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'

// The `POST /admin/certifications` create body. Numeric fields stay `number | null`:
// an unverified field the admin never filled is sent as null, not coerced to 0.
export interface DraftCreateBody {
  name: string
  provider: string
  code: string
  domains: CertificationDomain[]
  questionCount: number | null
  passingScore: number | null
  timeLimitMinutes: number | null
  provenance: Record<string, CertificationFieldProvenance>
  sourceUrl: string
}

// Submit is gated only on the domain weight-sum (per the design Pin) — unverified
// numeric fields may legitimately remain null when the admin submits a draft.
export function canCreateDraft(state: CertSetupWizardState): boolean {
  return validateDomainWeights(state.fieldValues.domains ?? [])
}

export function buildDraftCreateBody(state: CertSetupWizardState): DraftCreateBody {
  const provenance = state.fields ? buildProvenanceMap(state.fields, state.manualFields) : {}
  return {
    name: state.identity.name,
    provider: state.identity.provider,
    code: state.identity.code,
    domains: state.fieldValues.domains ?? [],
    questionCount: state.fieldValues.questionCount,
    passingScore: state.fieldValues.passingScore,
    timeLimitMinutes: state.fieldValues.timeLimitMinutes,
    provenance,
    sourceUrl: state.confirmedSourceUrl ?? '',
  }
}
