import type { Certification } from '@readion/db'
import type { CertificationResponse } from '@readion/shared'

export function mapCertificationToDto(cert: Certification): CertificationResponse {
  return {
    id: cert.id,
    name: cert.name,
    provider: cert.provider,
    code: cert.code,
    domains: cert.domains,
    questionCount: cert.questionCount,
    passingScore: cert.passingScore,
    timeLimitMinutes: cert.timeLimitMinutes,
    state: cert.state,
  }
}
