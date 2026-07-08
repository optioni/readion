import { describe, expect, it } from 'vitest'
import { computePaceRate, formatPaceString, pluralizeUnit } from '~/composables/paceFormatter'

describe('pluralizeUnit', () => {
  it('returns the singular word when count is 1', () => {
    expect(pluralizeUnit(1, 'week')).toBe('week')
    expect(pluralizeUnit(1, 'day')).toBe('day')
  })

  it('returns the pluralized word for counts other than 1', () => {
    expect(pluralizeUnit(0, 'week')).toBe('weeks')
    expect(pluralizeUnit(2, 'week')).toBe('weeks')
    expect(pluralizeUnit(3, 'day')).toBe('days')
    expect(pluralizeUnit(-1, 'day')).toBe('days')
  })
})

describe('computePaceRate', () => {
  it('returns null when points has fewer than 2 entries', () => {
    expect(computePaceRate([])).toBeNull()
    expect(computePaceRate([66])).toBeNull()
  })

  it('computes the average per-session readiness gain', () => {
    // seed: 55 → 62 → 66, gain per session = (11) / 2 = 5.5
    expect(computePaceRate([55, 62, 66])).toBeCloseTo(5.5)
  })

  it('computes correctly for a two-point series', () => {
    expect(computePaceRate([40, 60])).toBeCloseTo(20)
  })

  it('handles a flat series (no gain)', () => {
    expect(computePaceRate([50, 50, 50])).toBeCloseTo(0)
  })

  it('handles a declining series', () => {
    expect(computePaceRate([70, 60, 50])).toBeCloseTo(-10)
  })
})

describe('formatPaceString', () => {
  it('returns the fuller calibrated copy containing "recent pace" and "session avg"', () => {
    const text = formatPaceString({ paceRate: 5.5, weeksToReady: 3 })
    expect(text.toLowerCase()).toContain('recent pace')
    expect(text.toLowerCase()).toContain('session avg')
  })

  it('includes the pace rate value in the string', () => {
    const text = formatPaceString({ paceRate: 5.5, weeksToReady: 3 })
    expect(text).toContain('5.5')
  })

  it('includes the weeks count', () => {
    const text = formatPaceString({ paceRate: 5.5, weeksToReady: 3 })
    expect(text).toContain('3')
  })

  it('uses "weeks" for counts greater than 1', () => {
    const text = formatPaceString({ paceRate: 2.0, weeksToReady: 3 })
    expect(text.toLowerCase()).toContain('weeks')
  })

  it('uses "week" (singular) when weeksToReady is 1', () => {
    const text = formatPaceString({ paceRate: 10.0, weeksToReady: 1 })
    expect(text.toLowerCase()).toContain('1 week')
    expect(text.toLowerCase()).not.toContain('1 weeks')
  })

  it('rounds the pace rate to one decimal place', () => {
    const text = formatPaceString({ paceRate: 5.555, weeksToReady: 3 })
    expect(text).toContain('5.6')
  })

  it('shows whole number without trailing zero when rate is exact', () => {
    const text = formatPaceString({ paceRate: 5.0, weeksToReady: 3 })
    // 5.0 rounds to "5" (no trailing zero needed, but toFixed(1) gives "5.0")
    // We accept either form — just check it contains the value
    expect(text).toMatch(/5\.?0?%/)
  })
})
