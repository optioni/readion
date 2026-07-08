import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { friendlyDate } from '~/composables/friendlyDate'

describe('friendlyDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T15:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today, Mon D" for a timestamp on the current UTC calendar day', () => {
    expect(friendlyDate('2026-06-23T09:00:00.000Z')).toBe('Today, Jun 23')
  })

  it('returns the absolute "Mon D" form for a date before today', () => {
    expect(friendlyDate('2026-06-21T19:30:00.000Z')).toBe('Jun 21')
  })

  it('returns the absolute "Mon D" form for a date further in the past', () => {
    expect(friendlyDate('2026-06-01T09:00:00.000Z')).toBe('Jun 1')
  })

  it('returns an em dash for a null timestamp', () => {
    expect(friendlyDate(null)).toBe('—')
  })

  it('accepts an explicit "now" so callers are not bound to the system clock', () => {
    const now = new Date('2026-01-05T00:00:00.000Z')
    expect(friendlyDate('2026-01-05T23:00:00.000Z', now)).toBe('Today, Jan 5')
    expect(friendlyDate('2026-01-04T23:00:00.000Z', now)).toBe('Jan 4')
  })
})
