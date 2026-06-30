import { describe, expect, it } from 'vitest'
import {
  formatTtlRemaining,
  isTtlWarning,
  TTL_WARNING_THRESHOLD_MS,
  TTL_WINDOW_MS,
  ttlRemainingMs,
} from '~/composables/agentChatTtl'

const FIXED_NOW = new Date('2026-06-29T10:00:00.000Z').getTime()

describe('TTL constants', () => {
  it('TTL_WINDOW_MS is exactly 4 hours', () => {
    expect(TTL_WINDOW_MS).toBe(4 * 60 * 60 * 1000)
  })

  it('TTL_WARNING_THRESHOLD_MS is exactly 15 minutes', () => {
    expect(TTL_WARNING_THRESHOLD_MS).toBe(15 * 60 * 1000)
  })
})

describe('ttlRemainingMs', () => {
  it('returns full 4h window when lastActivityAt is null (safe default)', () => {
    const result = ttlRemainingMs(null, FIXED_NOW)
    expect(result).toBe(TTL_WINDOW_MS)
  })

  it('returns full 4h when lastActivityAt equals now', () => {
    const lastActivityAt = new Date(FIXED_NOW).toISOString()
    expect(ttlRemainingMs(lastActivityAt, FIXED_NOW)).toBe(TTL_WINDOW_MS)
  })

  it('returns ~3h 50m when lastActivityAt is 10 minutes ago', () => {
    const tenMinutesAgo = FIXED_NOW - 10 * 60 * 1000
    const lastActivityAt = new Date(tenMinutesAgo).toISOString()
    const remaining = ttlRemainingMs(lastActivityAt, FIXED_NOW)
    expect(remaining).toBe(TTL_WINDOW_MS - 10 * 60 * 1000)
  })

  it('returns ~5 min when lastActivityAt is 3h 55m ago (near expiry)', () => {
    const nearExpiry = FIXED_NOW - (TTL_WINDOW_MS - 5 * 60 * 1000)
    const lastActivityAt = new Date(nearExpiry).toISOString()
    const remaining = ttlRemainingMs(lastActivityAt, FIXED_NOW)
    expect(remaining).toBe(5 * 60 * 1000)
  })

  it('clamps to 0 when past expiry (does not return negative)', () => {
    const pastExpiry = FIXED_NOW - TTL_WINDOW_MS - 60 * 1000
    const lastActivityAt = new Date(pastExpiry).toISOString()
    expect(ttlRemainingMs(lastActivityAt, FIXED_NOW)).toBe(0)
  })

  it('returns full window for unparseable date string (safe default)', () => {
    expect(ttlRemainingMs('not-a-date', FIXED_NOW)).toBe(TTL_WINDOW_MS)
  })
})

describe('isTtlWarning', () => {
  it('returns false when remaining is the full window (no warning)', () => {
    expect(isTtlWarning(TTL_WINDOW_MS)).toBe(false)
  })

  it('returns false when remaining is exactly 0 (already expired)', () => {
    expect(isTtlWarning(0)).toBe(false)
  })

  it('returns true when remaining equals the warning threshold exactly', () => {
    expect(isTtlWarning(TTL_WARNING_THRESHOLD_MS)).toBe(true)
  })

  it('returns false when remaining is 1ms above the warning threshold', () => {
    expect(isTtlWarning(TTL_WARNING_THRESHOLD_MS + 1)).toBe(false)
  })

  it('returns true when remaining is 1ms below the warning threshold', () => {
    expect(isTtlWarning(TTL_WARNING_THRESHOLD_MS - 1)).toBe(true)
  })

  it('returns true when remaining is 12 minutes (illustrative artboard value)', () => {
    expect(isTtlWarning(12 * 60 * 1000)).toBe(true)
  })

  it('returns true when remaining is 5 minutes (near expiry)', () => {
    expect(isTtlWarning(5 * 60 * 1000)).toBe(true)
  })
})

describe('formatTtlRemaining', () => {
  it('formats hours and minutes for the full window', () => {
    expect(formatTtlRemaining(TTL_WINDOW_MS)).toBe('4h 0m')
  })

  it('formats ~3h 50m correctly', () => {
    expect(formatTtlRemaining(TTL_WINDOW_MS - 10 * 60 * 1000)).toBe('3h 50m')
  })

  it('formats minutes only when less than 1 hour remains', () => {
    expect(formatTtlRemaining(12 * 60 * 1000)).toBe('12m')
  })

  it('formats 0m when remaining is 0', () => {
    expect(formatTtlRemaining(0)).toBe('0m')
  })

  it('formats 1h 0m for exactly one hour', () => {
    expect(formatTtlRemaining(60 * 60 * 1000)).toBe('1h 0m')
  })

  it('formats 1h 1m for 61 minutes', () => {
    expect(formatTtlRemaining(61 * 60 * 1000)).toBe('1h 1m')
  })
})

describe('resets on activity', () => {
  it('recomputes remaining back toward the full window when lastActivityAt is refreshed', () => {
    const nearExpiryAt = new Date(FIXED_NOW - (TTL_WINDOW_MS - 5 * 60 * 1000)).toISOString()
    const staleRemaining = ttlRemainingMs(nearExpiryAt, FIXED_NOW)
    expect(staleRemaining).toBe(5 * 60 * 1000)

    const refreshedAt = new Date(FIXED_NOW).toISOString()
    const refreshedRemaining = ttlRemainingMs(refreshedAt, FIXED_NOW)
    expect(refreshedRemaining).toBe(TTL_WINDOW_MS)
    expect(refreshedRemaining).toBeGreaterThan(staleRemaining)
  })

  it('flips isTtlWarning from true to false once activity refreshes the window', () => {
    const nearExpiryAt = new Date(FIXED_NOW - (TTL_WINDOW_MS - 5 * 60 * 1000)).toISOString()
    expect(isTtlWarning(ttlRemainingMs(nearExpiryAt, FIXED_NOW))).toBe(true)

    const refreshedAt = new Date(FIXED_NOW).toISOString()
    expect(isTtlWarning(ttlRemainingMs(refreshedAt, FIXED_NOW))).toBe(false)
  })
})

describe('null-safety and no NaN', () => {
  it('null lastActivityAt produces no NaN in remaining', () => {
    const result = ttlRemainingMs(null, FIXED_NOW)
    expect(Number.isNaN(result)).toBe(false)
  })

  it('formatTtlRemaining with 0 does not produce NaN', () => {
    const result = formatTtlRemaining(0)
    expect(result).not.toContain('NaN')
  })

  it('isTtlWarning(0) is false (expired, not warning)', () => {
    expect(isTtlWarning(0)).toBe(false)
  })
})
