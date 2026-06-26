import { mapResponsesToDomainInputs, type ResponseWithDomain } from './response-domain-mapper'

export type DomainAccuracy = { domain: string; accuracy: number }

export type AccuracyRollup = {
  questionsAnswered: number
  accuracy: number
  domains: DomainAccuracy[]
}

export function summarizeResponses(responses: ResponseWithDomain[]): AccuracyRollup {
  if (responses.length === 0) {
    return { questionsAnswered: 0, accuracy: 0, domains: [] }
  }

  const correct = responses.filter((r) => r.correct).length
  const accuracy = Math.round((correct / responses.length) * 10000) / 10000

  const domainInputs = mapResponsesToDomainInputs(responses)
  const domains: DomainAccuracy[] = []
  for (const [domain, inputs] of domainInputs) {
    const domainCorrect = inputs.filter((i) => i.correct).length
    const domainAccuracy = Math.round((domainCorrect / inputs.length) * 10000) / 10000
    domains.push({ domain, accuracy: domainAccuracy })
  }

  return { questionsAnswered: responses.length, accuracy, domains }
}
