import { describe, expect, it } from 'vitest'
import { recentSessionLabel } from '~/composables/recentSessionLabel'
import type { SessionResponseDto } from '~~/src/api/model'

const sessionRow = (overrides: { kind: unknown; focusArea: unknown }): SessionResponseDto =>
  ({
    id: 's1',
    userCertificationId: 'enr-1',
    kind: overrides.kind,
    status: 'completed',
    durationMinutes: 30,
    contentMix: 'mixed',
    difficulty: 'standard',
    focusArea: overrides.focusArea,
    learningStyle: 'reading',
    lastItemIndex: 0,
    startedAt: '2026-06-20T00:00:00Z',
    // biome-ignore lint/suspicious/noExplicitAny: generated DTO fields are loosely typed
  }) as any

describe('recentSessionLabel', () => {
  it('formats a study session with a single focus domain', () => {
    expect(
      recentSessionLabel(
        sessionRow({ kind: 'study', focusArea: { mode: 'domains', domains: ['IAM'] } }),
      ),
    ).toBe('Study · IAM')
  })

  it('joins multiple focus domains', () => {
    expect(
      recentSessionLabel(
        sessionRow({
          kind: 'review',
          focusArea: { mode: 'domains', domains: ['IAM', 'Networking'] },
        }),
      ),
    ).toBe('Review · IAM, Networking')
  })

  it('renders an "All domains" label for an auto focus area', () => {
    expect(recentSessionLabel(sessionRow({ kind: 'study', focusArea: { mode: 'auto' } }))).toBe(
      'Study · All domains',
    )
  })

  it('falls back to "All domains" when the domains list is empty or missing', () => {
    expect(
      recentSessionLabel(
        sessionRow({ kind: 'study', focusArea: { mode: 'domains', domains: [] } }),
      ),
    ).toBe('Study · All domains')
    expect(recentSessionLabel(sessionRow({ kind: 'study', focusArea: { mode: 'domains' } }))).toBe(
      'Study · All domains',
    )
  })

  it('never produces [object Object]', () => {
    const label = recentSessionLabel(
      sessionRow({ kind: 'study', focusArea: { mode: 'domains', domains: ['IAM'] } }),
    )
    expect(label).not.toContain('[object Object]')
  })
})
