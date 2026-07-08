import { describe, expect, it } from 'vitest'
import {
  isActiveSessionStatus,
  isEndedSessionStatus,
  toSessionStatus,
} from '~/composables/sessionLifecycle'

describe('toSessionStatus', () => {
  it('passes through every known session status', () => {
    for (const status of ['active', 'completed', 'partial', 'abandoned'] as const) {
      expect(toSessionStatus(status)).toBe(status)
    }
  })

  it('falls back to active for an unrecognised string', () => {
    expect(toSessionStatus('bogus')).toBe('active')
  })

  it('falls back to active for a non-string value', () => {
    expect(toSessionStatus(undefined)).toBe('active')
    expect(toSessionStatus(null)).toBe('active')
    expect(toSessionStatus(42)).toBe('active')
  })
})

describe('isActiveSessionStatus / isEndedSessionStatus', () => {
  it('treats only active as active', () => {
    expect(isActiveSessionStatus('active')).toBe(true)
    expect(isEndedSessionStatus('active')).toBe(false)
  })

  it('treats completed, partial, and abandoned as ended', () => {
    for (const status of ['completed', 'partial', 'abandoned'] as const) {
      expect(isEndedSessionStatus(status)).toBe(true)
      expect(isActiveSessionStatus(status)).toBe(false)
    }
  })
})
