import { isCalibrated } from '../readiness/calibration'
import type { ReadinessDomainSignal } from '../readiness/readiness.calculator'
import { computeReadiness } from '../readiness/readiness.calculator'
import { computeDomainScore } from '../weak-areas/domain-scoring'

export type DeltaInput = {
  domain: string
  correct: boolean
  confidence: number
  createdAt: Date
}

export type DomainWeightInput = {
  domain: string
  weight: number
}

export type MockResultInput = {
  score: number
  at: Date
}

export type SessionReadinessChange = {
  before: number | null
  after: number | null
  delta: number | null
}

export type WeakAreaDeltaResult = {
  domain: string
  delta: number
}

export type DeltaCalculatorResult = {
  weakAreaDeltas: WeakAreaDeltaResult[]
  readiness: SessionReadinessChange
}

function groupByDomain(responses: DeltaInput[]): Map<string, DeltaInput[]> {
  const groups = new Map<string, DeltaInput[]>()
  for (const r of responses) {
    const existing = groups.get(r.domain) ?? []
    existing.push(r)
    groups.set(r.domain, existing)
  }
  return groups
}

function buildScores(byDomain: Map<string, DeltaInput[]>): {
  perDomain: ReadinessDomainSignal[]
  scoreByDomain: Map<string, number>
} {
  const perDomain: ReadinessDomainSignal[] = []
  const scoreByDomain = new Map<string, number>()

  for (const [domain, responses] of byDomain) {
    const [firstResponse] = responses
    if (firstResponse === undefined) continue
    const { score } = computeDomainScore(responses)
    const lastActivityAt = responses.reduce(
      (max, r) => (r.createdAt > max ? r.createdAt : max),
      firstResponse.createdAt,
    )
    perDomain.push({ domain, score, lastActivityAt })
    scoreByDomain.set(domain, score)
  }

  return { perDomain, scoreByDomain }
}

export function computeDeltas(params: {
  beforeResponses: DeltaInput[]
  afterResponses: DeltaInput[]
  domainWeights: DomainWeightInput[]
  mockResultsBefore: MockResultInput[]
  mockResultsAfter: MockResultInput[]
  calibrationThreshold: number
  hasCompletedDiagnostic: boolean
  now: Date
}): DeltaCalculatorResult {
  const beforeByDomain = groupByDomain(params.beforeResponses)
  const afterByDomain = groupByDomain(params.afterResponses)

  const { perDomain: beforePerDomain, scoreByDomain: beforeScores } = buildScores(beforeByDomain)
  const { perDomain: afterPerDomain, scoreByDomain: afterScores } = buildScores(afterByDomain)

  const weakAreaDeltas: WeakAreaDeltaResult[] = []
  for (const [domain, afterScore] of afterScores) {
    const beforeScore = beforeScores.get(domain) ?? 0
    weakAreaDeltas.push({ domain, delta: afterScore - beforeScore })
  }

  const beforeCalibrated = isCalibrated({
    gradedAnswerCount: params.beforeResponses.length,
    hasCompletedDiagnostic: params.hasCompletedDiagnostic,
    threshold: params.calibrationThreshold,
  })
  const afterCalibrated = isCalibrated({
    gradedAnswerCount: params.afterResponses.length,
    hasCompletedDiagnostic: params.hasCompletedDiagnostic,
    threshold: params.calibrationThreshold,
  })

  const readinessBefore = beforeCalibrated
    ? computeReadiness({
        perDomainScores: beforePerDomain,
        domainWeights: params.domainWeights,
        mockResults: params.mockResultsBefore,
        now: params.now,
      })
    : null

  const readinessAfter = afterCalibrated
    ? computeReadiness({
        perDomainScores: afterPerDomain,
        domainWeights: params.domainWeights,
        mockResults: params.mockResultsAfter,
        now: params.now,
      })
    : null

  const readinessDelta =
    readinessBefore !== null && readinessAfter !== null ? readinessAfter - readinessBefore : null

  return {
    weakAreaDeltas,
    readiness: {
      before: readinessBefore,
      after: readinessAfter,
      delta: readinessDelta,
    },
  }
}
