export type GradedResponse = {
  responseId: string
  question: string
  correct: boolean
  confidence: number
  timeTakenMs: number
  createdAt: Date
}

export type QuestionRef = {
  responseId: string
  question: string
}

export type WeakAreaScore = {
  domain: string
  score: number
}

export function selectWeakest(responses: GradedResponse[]): QuestionRef | null {
  const incorrect = responses.filter((r) => !r.correct)
  if (incorrect.length === 0) return null

  const sorted = [...incorrect].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence - b.confidence
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  const [first] = sorted
  if (first === undefined) return null
  return { responseId: first.responseId, question: first.question }
}

export function selectStrongest(responses: GradedResponse[]): QuestionRef | null {
  const correct = responses.filter((r) => r.correct)
  if (correct.length === 0) return null

  const sorted = [...correct].sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence
    return a.timeTakenMs - b.timeTakenMs
  })

  const [first] = sorted
  if (first === undefined) return null
  return { responseId: first.responseId, question: first.question }
}

export function selectNextFocus(weakAreas: WeakAreaScore[]): { domain: string } | null {
  if (weakAreas.length === 0) return null

  const sorted = [...weakAreas].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.domain.localeCompare(b.domain)
  })

  const [first] = sorted
  if (first === undefined) return null
  return { domain: first.domain }
}
