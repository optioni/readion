import { describe, expect, it } from 'vitest'
import { formatReadiness } from '~/composables/readinessFormat'

describe('formatReadiness', () => {
  it('reports the not-yet-calibrated state when calibrated is false', () => {
    expect(formatReadiness({ calibrated: false, score: null }, null)).toEqual({
      calibrated: false,
      label: 'not yet calibrated',
      percent: null,
      delta: null,
    })
  })

  it('reports the not-yet-calibrated state when score is null even if delta is present', () => {
    expect(formatReadiness({ calibrated: false, score: null }, 5)).toEqual({
      calibrated: false,
      label: 'not yet calibrated',
      percent: null,
      delta: null,
    })
  })

  it('formats percent and a positive signed delta when calibrated', () => {
    expect(formatReadiness({ calibrated: true, score: 75 }, 3)).toEqual({
      calibrated: true,
      label: null,
      percent: '75%',
      delta: '+3%',
    })
  })

  it('formats a negative signed delta', () => {
    expect(formatReadiness({ calibrated: true, score: 64 }, -2)).toEqual({
      calibrated: true,
      label: null,
      percent: '64%',
      delta: '-2%',
    })
  })

  it('omits delta when there is no prior session', () => {
    expect(formatReadiness({ calibrated: true, score: 50 }, null)).toEqual({
      calibrated: true,
      label: null,
      percent: '50%',
      delta: null,
    })
  })

  it('renders a zero delta as a signed zero', () => {
    expect(formatReadiness({ calibrated: true, score: 70 }, 0)).toEqual({
      calibrated: true,
      label: null,
      percent: '70%',
      delta: '+0%',
    })
  })
})
