import { describe, expect, it } from 'vitest'
import { daysSince, findLastStudiedAt } from '~/composables/lastStudiedAt'

describe('findLastStudiedAt', () => {
  it('returns null when no session focus area includes the domain', () => {
    const result = findLastStudiedAt(
      [
        { startedAt: '2026-06-20T00:00:00Z', focusArea: { mode: 'domains', domains: ['Billing'] } },
        { startedAt: '2026-06-19T00:00:00Z', focusArea: 'auto' },
      ],
      'Networking',
    )

    expect(result).toBeNull()
  })

  it('returns null when focusArea is a plain string (not a domains object)', () => {
    const result = findLastStudiedAt(
      [{ startedAt: '2026-06-20T00:00:00Z', focusArea: 'auto' }],
      'Networking',
    )

    expect(result).toBeNull()
  })

  it('returns the newest startedAt among sessions whose focusArea domains include the domain', () => {
    const result = findLastStudiedAt(
      [
        {
          startedAt: '2026-06-10T00:00:00Z',
          focusArea: { mode: 'domains', domains: ['Networking'] },
        },
        {
          startedAt: '2026-06-20T00:00:00Z',
          focusArea: { mode: 'domains', domains: ['Networking', 'Security'] },
        },
        { startedAt: '2026-06-15T00:00:00Z', focusArea: { mode: 'domains', domains: ['Billing'] } },
      ],
      'Networking',
    )

    expect(result).toBe('2026-06-20T00:00:00Z')
  })
})

describe('daysSince', () => {
  it('computes the whole number of days between the timestamp and now', () => {
    const now = new Date('2026-06-22T00:00:00Z')
    expect(daysSince('2026-06-20T00:00:00Z', now)).toBe(2)
  })

  it('floors partial days rather than rounding', () => {
    const now = new Date('2026-06-22T23:00:00Z')
    expect(daysSince('2026-06-20T00:00:00Z', now)).toBe(2)
  })

  it('never returns a negative day count', () => {
    const now = new Date('2026-06-20T00:00:00Z')
    expect(daysSince('2026-06-22T00:00:00Z', now)).toBe(0)
  })
})
