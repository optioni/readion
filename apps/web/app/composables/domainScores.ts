import type { StatusColorKey } from '~/composables/statusColor'
import { statusColorForScore } from '~/composables/statusColor'
import type { CertificationDomainDto, WeakAreaResponseDto } from '~~/src/api/model'

export interface DomainScoreRow {
  domain: string
  score: number | null
  status: StatusColorKey | null
  hasData: boolean
}

export function joinDomainScores(
  domains: CertificationDomainDto[],
  weakAreas: WeakAreaResponseDto[],
): DomainScoreRow[] {
  return domains.map((domain) => {
    const weakArea = weakAreas.find((area) => area.domain === domain.name)
    if (!weakArea) {
      return { domain: domain.name, score: null, status: null, hasData: false }
    }
    return {
      domain: domain.name,
      score: weakArea.score,
      status: statusColorForScore(weakArea.score),
      hasData: true,
    }
  })
}
