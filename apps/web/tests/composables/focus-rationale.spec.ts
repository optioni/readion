import { describe, expect, it } from 'vitest'
import { buildFocusRationale } from '~/composables/focusRationale'

describe('buildFocusRationale', () => {
  it('returns null when no score is derivable', () => {
    expect(buildFocusRationale(null, null)).toBeNull()
  })

  it('shows only the score-based reason when last-studied is not derivable', () => {
    expect(buildFocusRationale(45, null)).toBe('Lowest domain score (45%).')
  })

  it('appends a singular last-studied clause for a one-day gap', () => {
    expect(buildFocusRationale(45, 1)).toBe('Lowest domain score (45%). Last studied 1 day ago.')
  })

  it('appends a plural last-studied clause for a multi-day gap', () => {
    expect(buildFocusRationale(45, 2)).toBe('Lowest domain score (45%). Last studied 2 days ago.')
  })
})
