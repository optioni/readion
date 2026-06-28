import { describe, expect, it } from 'vitest'
import { filterSessionsByType } from '~/composables/sessionTypeFilter'
import type { SessionResponseDto } from '~~/src/api/model'

const row = (id: string, kind: string): SessionResponseDto =>
  ({
    id,
    userCertificationId: 'enr-1',
    kind,
    status: 'completed',
    durationMinutes: 30,
    contentMix: 'mixed',
    difficulty: 'standard',
    focusArea: 'Networking',
    learningStyle: 'reading',
    lastItemIndex: 0,
    startedAt: '2026-06-20T00:00:00Z',
    // biome-ignore lint/suspicious/noExplicitAny: generated DTO loose-typed, narrowed in tests
  }) as any

const rows = [row('s1', 'study'), row('s2', 'review'), row('s3', 'study')]

describe('filterSessionsByType', () => {
  it('returns every row for the "all" filter', () => {
    expect(filterSessionsByType(rows, 'all')).toEqual(rows)
  })

  it('keeps only study rows for the "study" filter', () => {
    expect(filterSessionsByType(rows, 'study').map((r) => r.id)).toEqual(['s1', 's3'])
  })

  it('keeps only review rows for the "review" filter', () => {
    expect(filterSessionsByType(rows, 'review').map((r) => r.id)).toEqual(['s2'])
  })
})
