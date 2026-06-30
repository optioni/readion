import { describe, expect, it } from 'vitest'
import { selectSuggestedNextFocus } from '~/composables/suggestedNextFocus'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const weakArea = (overrides: { domain: string; score: number }): WeakAreaResponseDto => ({
  id: overrides.domain,
  domain: overrides.domain,
  score: overrides.score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

describe('selectSuggestedNextFocus', () => {
  it('prefers the latest completed session nextFocus domain', () => {
    expect(
      selectSuggestedNextFocus('Networking', [weakArea({ domain: 'Security', score: 30 })]),
    ).toEqual({ domain: 'Networking', source: 'session', score: null })
  })

  it('falls back to the lowest-scoring weak-area domain when there is no session focus', () => {
    expect(
      selectSuggestedNextFocus(null, [
        weakArea({ domain: 'Security', score: 61 }),
        weakArea({ domain: 'Billing', score: 42 }),
        weakArea({ domain: 'Storage', score: 70 }),
      ]),
    ).toEqual({ domain: 'Billing', source: 'weak-area', score: 42 })
  })

  it('yields a neutral placeholder when neither a session focus nor weak areas exist', () => {
    expect(selectSuggestedNextFocus(null, [])).toEqual({ domain: null, source: 'none', score: null })
  })
})
