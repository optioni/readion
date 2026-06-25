const SCORE_MAX = 100

export type DomainScoreInput = {
  correct: boolean
  confidence: number
}

export type DomainScoreResult = {
  score: number
  accuracy: number
  meanConfidence: number
  responseCount: number
}

export function computeDomainScore(responses: DomainScoreInput[]): DomainScoreResult {
  const n = responses.length
  if (n === 0) {
    return { score: 0, accuracy: 0, meanConfidence: 0, responseCount: 0 }
  }

  let correctCount = 0
  let confidenceSum = 0
  let signedSum = 0

  for (const r of responses) {
    if (r.correct) correctCount++
    confidenceSum += r.confidence
    signedSum += r.correct ? r.confidence / 5 : -(r.confidence / 5)
  }

  const accuracy = correctCount / n
  const meanConfidence = confidenceSum / n
  const rawSignal = signedSum / n
  const score = Math.min(SCORE_MAX, Math.max(0, Math.round(((rawSignal + 1) / 2) * SCORE_MAX)))

  return { score, accuracy, meanConfidence, responseCount: n }
}
