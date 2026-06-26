import { describe, expect, it } from 'vitest'
import type { DeltaInput, DomainWeightInput } from './delta-calculator'
import { computeDeltas } from './delta-calculator'

const NOW = new Date('2024-01-15T12:00:00Z')
const BEFORE_SESSION = new Date('2024-01-14T10:00:00Z')
const DURING_SESSION = new Date('2024-01-15T10:00:00Z')

function makeResponse(
  domain: string,
  correct: boolean,
  confidence: number,
  createdAt: Date = BEFORE_SESSION,
): DeltaInput {
  return { domain, correct, confidence, createdAt }
}

const WEIGHTS: DomainWeightInput[] = [
  { domain: 'compute', weight: 0.5 },
  { domain: 'networking', weight: 0.3 },
  { domain: 'storage', weight: 0.2 },
]

const THRESHOLD = 10

describe('computeDeltas', () => {
  it('returns empty deltas and null readiness for empty before and after', () => {
    const result = computeDeltas({
      beforeResponses: [],
      afterResponses: [],
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    expect(result.weakAreaDeltas).toEqual([])
    expect(result.readiness).toEqual({ before: null, after: null, delta: null })
  })

  it('returns null readiness.after and null delta when after is not yet calibrated', () => {
    const afterResponses: DeltaInput[] = [
      makeResponse('compute', true, 4, BEFORE_SESSION),
      makeResponse('compute', false, 2, BEFORE_SESSION),
    ]

    const result = computeDeltas({
      beforeResponses: [],
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: 20,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    expect(result.readiness.before).toBeNull()
    expect(result.readiness.after).toBeNull()
    expect(result.readiness.delta).toBeNull()
  })

  it('computes readiness delta = after - before when both sets are calibrated', () => {
    const beforeResponses: DeltaInput[] = Array.from({ length: 10 }, (_, i) =>
      makeResponse('compute', true, 4, new Date(BEFORE_SESSION.getTime() + i * 60_000)),
    )
    const sessionResponses: DeltaInput[] = Array.from({ length: 5 }, (_, i) =>
      makeResponse('networking', false, 5, new Date(DURING_SESSION.getTime() + i * 60_000)),
    )
    const afterResponses = [...beforeResponses, ...sessionResponses]

    const result = computeDeltas({
      beforeResponses,
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    const { before, after, delta } = result.readiness
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(delta).not.toBeNull()
    if (before === null || after === null || delta === null) return
    expect(delta).toBe(after - before)
  })

  it('returns null delta when before is not calibrated but after is', () => {
    const beforeResponses: DeltaInput[] = Array.from({ length: 3 }, () =>
      makeResponse('compute', true, 4, BEFORE_SESSION),
    )
    const sessionResponses: DeltaInput[] = Array.from({ length: 10 }, (_, i) =>
      makeResponse('compute', true, 4, new Date(DURING_SESSION.getTime() + i * 60_000)),
    )
    const afterResponses = [...beforeResponses, ...sessionResponses]

    const result = computeDeltas({
      beforeResponses,
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    expect(result.readiness.before).toBeNull()
    expect(result.readiness.after).not.toBeNull()
    expect(result.readiness.delta).toBeNull()
  })

  it('computes domain delta as afterScore when domain is only in after (before baseline is 0)', () => {
    // before: only networking, no compute
    const beforeResponses: DeltaInput[] = Array.from({ length: 10 }, () =>
      makeResponse('networking', true, 5, BEFORE_SESSION),
    )
    // session adds all-correct-conf-5 compute responses: computeDomainScore => score=100
    const computeResponses: DeltaInput[] = [
      makeResponse('compute', true, 5, DURING_SESSION),
      makeResponse('compute', true, 5, DURING_SESSION),
    ]
    const afterResponses = [...beforeResponses, ...computeResponses]

    const result = computeDeltas({
      beforeResponses,
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    const computeDelta = result.weakAreaDeltas.find((d) => d.domain === 'compute')
    expect(computeDelta).toBeDefined()
    // afterScore=100 (all correct conf=5), beforeScore=0 (domain absent), delta=100
    expect(computeDelta?.delta).toBe(100)
  })

  it('computes domain delta as afterScore minus beforeScore for domain present in both sets', () => {
    // before: 10 networking all-wrong-conf-5 => score=0
    const beforeResponses: DeltaInput[] = Array.from({ length: 10 }, () =>
      makeResponse('networking', false, 5, BEFORE_SESSION),
    )
    // session adds 10 correct networking responses; after total: 10 wrong + 10 correct conf=5
    // signedSum=-10+10=0, rawSignal=0, score=50; delta = 50 - 0 = 50
    const sessionResponses: DeltaInput[] = Array.from({ length: 10 }, (_, i) =>
      makeResponse('networking', true, 5, new Date(DURING_SESSION.getTime() + i * 60_000)),
    )
    const afterResponses = [...beforeResponses, ...sessionResponses]

    const result = computeDeltas({
      beforeResponses,
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    const networkingDelta = result.weakAreaDeltas.find((d) => d.domain === 'networking')
    expect(networkingDelta).toBeDefined()
    expect(networkingDelta?.delta).toBe(50)
  })

  it('delta reflects only session contribution when beforeResponses excludes session responses', () => {
    // before: 10 compute all-correct-conf-4 => score=90
    const beforeResponses: DeltaInput[] = Array.from({ length: 10 }, (_, i) =>
      makeResponse('compute', true, 4, new Date(BEFORE_SESSION.getTime() + i * 60_000)),
    )
    // session adds 2 wrong-conf-5 compute responses — should depress the score
    // after: 12 responses; signedSum=10*(4/5)+2*(-5/5)=8-2=6; rawSignal=6/12=0.5; score=75
    // delta = 75 - 90 = -15
    const sessionResponses: DeltaInput[] = [
      makeResponse('compute', false, 5, DURING_SESSION),
      makeResponse('compute', false, 5, new Date(DURING_SESSION.getTime() + 60_000)),
    ]
    const afterResponses = [...beforeResponses, ...sessionResponses]

    const result = computeDeltas({
      beforeResponses,
      afterResponses,
      domainWeights: WEIGHTS,
      mockResultsBefore: [],
      mockResultsAfter: [],
      calibrationThreshold: THRESHOLD,
      hasCompletedDiagnostic: false,
      now: NOW,
    })

    const computeDelta = result.weakAreaDeltas.find((d) => d.domain === 'compute')
    expect(computeDelta).toBeDefined()
    // Session added wrong answers, so the score went down — delta must be negative
    expect(computeDelta?.delta).toBeLessThan(0)
    expect(computeDelta?.delta).toBe(-15)
  })
})
