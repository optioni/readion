import { describe, expect, it } from 'vitest'
import { isNudgeLullCandidate } from './nudge-lull'

// Fixed clock for deterministic windowing.
const NOW = new Date('2026-06-29T12:00:00Z')
const LULL_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

describe('isNudgeLullCandidate', () => {
  const cases: Array<{
    name: string
    lastActivityAt: Date | null
    expected: boolean
  }> = [
    {
      name: 'activity older than the lull window → candidate',
      lastActivityAt: new Date(NOW.getTime() - (LULL_DAYS + 1) * MS_PER_DAY),
      expected: true,
    },
    {
      name: 'activity just inside the window → excluded',
      lastActivityAt: new Date(NOW.getTime() - (LULL_DAYS - 1) * MS_PER_DAY),
      expected: false,
    },
    {
      name: 'activity exactly at the window boundary → excluded',
      lastActivityAt: new Date(NOW.getTime() - LULL_DAYS * MS_PER_DAY),
      expected: false,
    },
    {
      name: 'activity one ms past the boundary → candidate',
      lastActivityAt: new Date(NOW.getTime() - LULL_DAYS * MS_PER_DAY - 1),
      expected: true,
    },
    {
      name: 'no recorded activity → not a candidate',
      lastActivityAt: null,
      expected: false,
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      expect(
        isNudgeLullCandidate({ now: NOW, lastActivityAt: c.lastActivityAt, lullDays: LULL_DAYS }),
      ).toBe(c.expected)
    })
  }
})
