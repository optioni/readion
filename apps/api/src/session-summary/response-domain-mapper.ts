import type { DomainScoreInput } from '../weak-areas/domain-scoring'

export type ResponseWithDomain = {
  correct: boolean
  confidence: number
  primaryDomain: string
}

export function mapResponsesToDomainInputs(
  responses: ResponseWithDomain[],
): Map<string, DomainScoreInput[]> {
  const domainInputs = new Map<string, DomainScoreInput[]>()
  for (const r of responses) {
    const entry = domainInputs.get(r.primaryDomain) ?? []
    entry.push({ correct: r.correct, confidence: r.confidence })
    domainInputs.set(r.primaryDomain, entry)
  }
  return domainInputs
}
