export interface CertificationDomain {
  name: string
  weight: number
}

export interface CertificationFieldCitation {
  url: string
  passage: string
}

export type CertificationProvenance = 'verified' | Record<string, CertificationFieldCitation>

export type CertificationState = 'draft' | 'live'

export interface CertificationResponse {
  id: string
  name: string
  provider: string
  code: string
  domains: CertificationDomain[]
  questionCount: number
  passingScore: number
  timeLimitMinutes: number
  state: CertificationState
}
