import type { ReviewTarget } from '../sessions/sessions.service'

export type SessionResponseTarget = {
  correct: boolean
  confidence: number
  domain: string
  anchorChunkId: string
}

export type MockQuestionTarget = {
  selectedAnswer: string | null
  correctAnswer: string
  domain: string
  anchorChunkId: string
}

export function sessionResponseQualifies(
  response: { correct: boolean; confidence: number },
  unsureThreshold: number,
): boolean {
  return !response.correct || response.confidence <= unsureThreshold
}

export function mockQuestionQualifies(question: {
  selectedAnswer: string | null
  correctAnswer: string
}): boolean {
  return question.selectedAnswer === null || question.selectedAnswer !== question.correctAnswer
}

export function selectDrillTargets(
  targets: (SessionResponseTarget | MockQuestionTarget)[],
  type: 'session' | 'mock',
  params: {
    unsureThreshold: number
    maxTargets: number
  },
): ReviewTarget[] {
  const qualifying = targets.filter((t) => {
    if (type === 'session') {
      const r = t as SessionResponseTarget
      return sessionResponseQualifies({ correct: r.correct, confidence: r.confidence }, params.unsureThreshold)
    }
    const q = t as MockQuestionTarget
    return mockQuestionQualifies(q)
  })

  const seen = new Set<string>()
  const deduped: ReviewTarget[] = []
  for (const t of qualifying) {
    if (!seen.has(t.anchorChunkId)) {
      seen.add(t.anchorChunkId)
      deduped.push({ domain: t.domain, anchorChunkId: t.anchorChunkId })
    }
  }

  return deduped.slice(0, params.maxTargets)
}
