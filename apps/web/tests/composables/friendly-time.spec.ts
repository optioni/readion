import { describe, expect, it } from 'vitest'
import { friendlyTime } from '~/composables/friendlyTime'

describe('friendlyTime', () => {
  it('formats an afternoon time as h:mm AM/PM', () => {
    expect(friendlyTime('2026-06-23T15:42:00.000Z')).toBe('3:42 PM')
  })

  it('formats a morning time', () => {
    expect(friendlyTime('2026-06-23T09:15:00.000Z')).toBe('9:15 AM')
  })

  it('formats midnight as 12:00 AM', () => {
    expect(friendlyTime('2026-06-23T00:00:00.000Z')).toBe('12:00 AM')
  })

  it('formats noon as 12:00 PM', () => {
    expect(friendlyTime('2026-06-23T12:00:00.000Z')).toBe('12:00 PM')
  })

  it('pads single-digit minutes', () => {
    expect(friendlyTime('2026-06-23T08:05:00.000Z')).toBe('8:05 AM')
  })

  it('returns an em dash for a null value', () => {
    expect(friendlyTime(null)).toBe('—')
  })
})
