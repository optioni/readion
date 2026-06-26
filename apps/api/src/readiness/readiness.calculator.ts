const SCORE_MIN = 0
const SCORE_MAX = 100

// A domain with no recent signal contributes the neutral midpoint rather than 0,
// so an unknown domain neither inflates nor tanks readiness.
const NEUTRAL_SCORE = 50

// Recency half-life: a signal this many days old contributes half its distance from neutral.
const RECENCY_HALF_LIFE_DAYS = 14
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Mocks weigh more than ordinary session-quiz signal (SPEC: mocks "higher weight").
const QUIZ_BLEND_WEIGHT = 1
const MOCK_BLEND_WEIGHT = 2

export type ReadinessDomainSignal = {
  domain: string
  score: number
  lastActivityAt: Date
}

export type ReadinessMockResult = {
  score: number
  at: Date
}

export type ReadinessDomainWeight = {
  domain: string
  weight: number
}

export type ReadinessCalculatorInput = {
  perDomainScores: ReadinessDomainSignal[]
  domainWeights: ReadinessDomainWeight[]
  mockResults: ReadinessMockResult[]
  now: Date
}

function recencyWeight(at: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / MS_PER_DAY)
  return 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS)
}

// Decays a score toward the neutral midpoint as its underlying signal ages.
function recencyAdjusted(score: number, at: Date, now: Date): number {
  return NEUTRAL_SCORE + (score - NEUTRAL_SCORE) * recencyWeight(at, now)
}

function clampScore(value: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value))
}

function domainBlend(input: ReadinessCalculatorInput): number {
  const signalByDomain = new Map(input.perDomainScores.map((s) => [s.domain, s]))

  let weightedSum = 0
  let totalWeight = 0
  for (const { domain, weight } of input.domainWeights) {
    if (weight <= 0) continue
    const signal = signalByDomain.get(domain)
    const effective =
      signal === undefined
        ? NEUTRAL_SCORE
        : recencyAdjusted(signal.score, signal.lastActivityAt, input.now)
    weightedSum += effective * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return NEUTRAL_SCORE
  return weightedSum / totalWeight
}

function mockBlend(input: ReadinessCalculatorInput): number | null {
  let weightedSum = 0
  let totalWeight = 0
  for (const mock of input.mockResults) {
    const weight = recencyWeight(mock.at, input.now)
    weightedSum += mock.score * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return null
  return weightedSum / totalWeight
}

export function computeReadiness(input: ReadinessCalculatorInput): number {
  const quizScore = domainBlend(input)
  const mockScore = mockBlend(input)

  if (mockScore === null) {
    return Math.round(clampScore(quizScore))
  }

  const blended =
    (quizScore * QUIZ_BLEND_WEIGHT + mockScore * MOCK_BLEND_WEIGHT) /
    (QUIZ_BLEND_WEIGHT + MOCK_BLEND_WEIGHT)

  return Math.round(clampScore(blended))
}
