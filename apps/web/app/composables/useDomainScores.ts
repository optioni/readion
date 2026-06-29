import type { DomainScoreRow } from '~/composables/domainScores'
import { joinDomainScores } from '~/composables/domainScores'
import type {
  CertificationDomainDto,
  SessionSummaryResponseDto,
  WeakAreaResponseDto,
} from '~~/src/api/model'

export interface DomainScoreWithDeltaRow extends DomainScoreRow {
  delta: number | null
}

export function useDomainScores(
  domains: CertificationDomainDto[],
  weakAreas: WeakAreaResponseDto[],
  latestSummary: SessionSummaryResponseDto | null,
): DomainScoreWithDeltaRow[] {
  const base = joinDomainScores(domains, weakAreas)

  const deltaMap = new Map<string, number>()
  if (latestSummary) {
    for (const { domain, delta } of latestSummary.weakAreaDeltas) {
      deltaMap.set(domain, delta)
    }
  }

  return base.map((row) => ({
    ...row,
    delta: deltaMap.has(row.domain) ? (deltaMap.get(row.domain) as number) : null,
  }))
}
