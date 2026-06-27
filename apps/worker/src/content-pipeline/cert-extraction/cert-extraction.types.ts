import type { CertificationDomain } from '@readion/shared'

export interface CertExtractionJobData {
  name: string
  code?: string
  confirmedSourceUrl: string
}

export interface FieldProposal<T> {
  value: T
  passage: string
}

export interface CertFieldProposals {
  domains: FieldProposal<CertificationDomain[]> | null
  questionCount: FieldProposal<number> | null
  passingScore: FieldProposal<number> | null
  timeLimitMinutes: FieldProposal<number> | null
}
