export const DEFAULT_MIN_CHUNKS_PER_DOMAIN = 20
export const DEFAULT_TOTAL_CHUNK_MULTIPLE = 3

export interface DomainStat {
  name: string
  chunkCount: number
  enabledSourceCount: number
}

export interface DomainCoverage {
  name: string
  chunkCount: number
  chunkThreshold: number
  enabledSourceCount: number
  met: boolean
}

export interface CoverageThresholds {
  minChunksPerDomain: number
  totalChunkMultiple: number
}

export interface CoverageEvaluation {
  domains: DomainCoverage[]
  totalChunks: number
  totalThreshold: number
  met: boolean
}

export function evaluateCoverage(
  domainList: string[],
  domainStats: DomainStat[],
  totalChunks: number,
  questionCount: number,
  thresholds: CoverageThresholds,
): CoverageEvaluation {
  if (domainList.length === 0) {
    return {
      domains: [],
      totalChunks,
      totalThreshold: thresholds.totalChunkMultiple * questionCount,
      met: false,
    }
  }

  const statsByName = new Map(domainStats.map((s) => [s.name, s]))
  const totalThreshold = thresholds.totalChunkMultiple * questionCount

  const domains: DomainCoverage[] = domainList.map((name) => {
    const stat = statsByName.get(name) ?? { name, chunkCount: 0, enabledSourceCount: 0 }
    const met = stat.chunkCount >= thresholds.minChunksPerDomain && stat.enabledSourceCount >= 1

    return {
      name,
      chunkCount: stat.chunkCount,
      chunkThreshold: thresholds.minChunksPerDomain,
      enabledSourceCount: stat.enabledSourceCount,
      met,
    }
  })

  const allDomainsMet = domains.every((d) => d.met)
  const totalMet = totalChunks >= totalThreshold

  return {
    domains,
    totalChunks,
    totalThreshold,
    met: allDomainsMet && totalMet,
  }
}
