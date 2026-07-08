import type { ReviewItemResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { formatOverdueSummary, useOverdueSummary } from '~/composables/useOverdueSummary'

const makeItem = (id: string, dueAt: string): ReviewItemResponse => ({
  id,
  userCertificationId: 'uc-1',
  anchorChunkId: `chunk-${id}`,
  domain: 'Security',
  box: 1,
  state: 'active',
  dueAt,
  lastReviewedAt: null,
})

const NOW = new Date('2026-07-01T09:00:00.000Z')

describe('useOverdueSummary', () => {
  it('returns null when there are no items', () => {
    expect(useOverdueSummary([], NOW)).toBeNull()
  })

  it('returns null when no item is overdue by a whole day', () => {
    const items = [makeItem('i-1', '2026-07-01T00:00:00.000Z')]
    expect(useOverdueSummary(items, NOW)).toBeNull()
  })

  it('counts items overdue by at least one whole day and reports the max days', () => {
    const items = [
      makeItem('i-1', '2026-06-29T00:00:00.000Z'),
      makeItem('i-2', '2026-06-29T00:00:00.000Z'),
      makeItem('i-3', '2026-07-01T00:00:00.000Z'),
      makeItem('i-4', '2026-07-01T00:00:00.000Z'),
      makeItem('i-5', '2026-06-29T00:00:00.000Z'),
    ]
    expect(useOverdueSummary(items, NOW)).toEqual({ count: 3, days: 2 })
  })

  it('reports the oldest (max) overdue-by-days value across mixed overdue items', () => {
    const items = [
      makeItem('i-1', '2026-06-25T00:00:00.000Z'),
      makeItem('i-2', '2026-06-29T00:00:00.000Z'),
    ]
    expect(useOverdueSummary(items, NOW)).toEqual({ count: 2, days: 6 })
  })

  it('treats a single overdue item as count 1', () => {
    const items = [makeItem('i-1', '2026-06-29T00:00:00.000Z')]
    expect(useOverdueSummary(items, NOW)).toEqual({ count: 1, days: 2 })
  })
})

describe('formatOverdueSummary', () => {
  it('pluralizes both items and days for counts greater than one', () => {
    expect(formatOverdueSummary({ count: 3, days: 2 })).toBe('3 items overdue by 2 days')
  })

  it('uses singular "item" and "day" when both are exactly one', () => {
    expect(formatOverdueSummary({ count: 1, days: 1 })).toBe('1 item overdue by 1 day')
  })

  it('uses singular "item" with plural "days" when only the count is one', () => {
    expect(formatOverdueSummary({ count: 1, days: 4 })).toBe('1 item overdue by 4 days')
  })

  it('uses plural "items" with singular "day" when only the days is one', () => {
    expect(formatOverdueSummary({ count: 2, days: 1 })).toBe('2 items overdue by 1 day')
  })
})
