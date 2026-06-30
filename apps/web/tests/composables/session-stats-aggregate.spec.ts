import { describe, expect, it } from 'vitest'
import { aggregateSessionStats } from '~/composables/sessionStatsAggregate'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

const summary = (overrides: {
  questionsAnswered: number
  accuracy: number
}): SessionSummaryResponseDto => ({
  questionsAnswered: overrides.questionsAnswered,
  accuracy: overrides.accuracy,
  domains: [],
  weakAreaDeltas: [],
  readiness: {},
})

const mapOf = (entries: SessionSummaryResponseDto[]): Map<string, SessionSummaryResponseDto> =>
  new Map(entries.map((entry, index) => [`s${index}`, entry]))

describe('aggregateSessionStats', () => {
  it('sums questionsAnswered and means accuracy across summaries', () => {
    const result = aggregateSessionStats(
      mapOf([
        summary({ questionsAnswered: 12, accuracy: 0.8 }),
        summary({ questionsAnswered: 14, accuracy: 0.64 }),
        summary({ questionsAnswered: 18, accuracy: 0.73 }),
      ]),
    )
    expect(result.questionsAnswered).toBe(44)
    expect(result.accuracy).not.toBeNull()
    expect(Math.round((result.accuracy as number) * 100)).toBe(72)
  })

  it('returns 0 questions and null accuracy for an empty map', () => {
    const result = aggregateSessionStats(new Map())
    expect(result.questionsAnswered).toBe(0)
    expect(result.accuracy).toBeNull()
  })
})
