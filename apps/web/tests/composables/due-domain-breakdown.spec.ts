import type { ReviewItemResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { useDueDomainBreakdown } from '~/composables/useDueDomainBreakdown'

const makeItem = (id: string, domain: string): ReviewItemResponse => ({
  id,
  userCertificationId: 'uc-1',
  anchorChunkId: `chunk-${id}`,
  domain,
  box: 1,
  state: 'active',
  dueAt: '2026-01-01T00:00:00Z',
  lastReviewedAt: null,
})

describe('useDueDomainBreakdown', () => {
  it('returns an empty array when there are no items', () => {
    const result = useDueDomainBreakdown([])
    expect(result).toEqual([])
  })

  it('returns one entry per domain with the correct count', () => {
    const items = [
      makeItem('i-1', 'Networking'),
      makeItem('i-2', 'Networking'),
      makeItem('i-3', 'Security'),
    ]

    const result = useDueDomainBreakdown(items)

    const networking = result.find((r) => r.domain === 'Networking')
    const security = result.find((r) => r.domain === 'Security')

    expect(networking).toEqual({ domain: 'Networking', count: 2 })
    expect(security).toEqual({ domain: 'Security', count: 1 })
  })

  it('returns exactly one entry when all items belong to the same domain', () => {
    const items = [
      makeItem('i-1', 'Storage'),
      makeItem('i-2', 'Storage'),
      makeItem('i-3', 'Storage'),
    ]

    const result = useDueDomainBreakdown(items)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ domain: 'Storage', count: 3 })
  })

  it('sorts results by count descending', () => {
    const items = [
      makeItem('i-1', 'Storage'),
      makeItem('i-2', 'Networking'),
      makeItem('i-3', 'Networking'),
      makeItem('i-4', 'Security'),
      makeItem('i-5', 'Security'),
      makeItem('i-6', 'Security'),
    ]

    const result = useDueDomainBreakdown(items)

    expect(result[0].domain).toBe('Security')
    expect(result[0].count).toBe(3)
    expect(result[1].count).toBe(2)
    expect(result[2].count).toBe(1)
  })

  it('sorts alphabetically by domain name when counts are equal', () => {
    const items = [makeItem('i-1', 'Storage'), makeItem('i-2', 'Networking')]

    const result = useDueDomainBreakdown(items)

    expect(result.map((r) => r.domain)).toEqual(['Networking', 'Storage'])
  })

  it('handles a single item', () => {
    const items = [makeItem('i-1', 'IAM')]

    const result = useDueDomainBreakdown(items)

    expect(result).toEqual([{ domain: 'IAM', count: 1 }])
  })
})
