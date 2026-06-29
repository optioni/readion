import { describe, expect, it } from 'vitest'
import { useAccuracySeries } from '~/composables/useAccuracySeries'
import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

const makeSession = (id: string, startedAt: string, status = 'completed'): SessionResponseDto => ({
  id,
  userCertificationId: 'uc-1',
  kind: 'study' as SessionResponseDto['kind'],
  status: status as SessionResponseDto['status'],
  durationMinutes: 30,
  contentMix: 'balanced',
  difficulty: 'medium',
  focusArea: 'general' as SessionResponseDto['focusArea'],
  learningStyle: 'visual',
  lastItemIndex: 0,
  startedAt,
})

const makeSummary = (accuracy: number): SessionSummaryResponseDto => ({
  questionsAnswered: 10,
  accuracy,
  domains: [],
  weakAreaDeltas: [],
  readiness: { before: null, after: null, delta: null },
})

describe('useAccuracySeries', () => {
  it('returns an empty array when no summaries are available', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const summaries = new Map<string, SessionSummaryResponseDto>()

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([])
  })

  it('returns accuracy points in chronological order (oldest first)', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-03T10:00:00Z'),
      makeSession('s-3', '2026-01-05T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(75)],
      ['s-2', makeSummary(82)],
      ['s-3', makeSummary(91)],
    ])

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([
      { sessionId: 's-1', accuracy: 75 },
      { sessionId: 's-2', accuracy: 82 },
      { sessionId: 's-3', accuracy: 91 },
    ])
  })

  it('omits sessions that have no summary entry', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-02T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(80)],
      // s-2 has no summary
    ])

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([{ sessionId: 's-1', accuracy: 80 }])
  })

  it('omits non-completed sessions even when a summary is present', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z', 'completed'),
      makeSession('s-2', '2026-01-02T10:00:00Z', 'active'),
      makeSession('s-3', '2026-01-03T10:00:00Z', 'abandoned'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(80)],
      ['s-2', makeSummary(85)],
      ['s-3', makeSummary(90)],
    ])

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([{ sessionId: 's-1', accuracy: 80 }])
  })

  it('sorts sessions chronologically even when provided out of order', () => {
    const sessions = [
      makeSession('s-3', '2026-01-05T10:00:00Z'),
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-03T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(70)],
      ['s-2', makeSummary(78)],
      ['s-3', makeSummary(85)],
    ])

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([
      { sessionId: 's-1', accuracy: 70 },
      { sessionId: 's-2', accuracy: 78 },
      { sessionId: 's-3', accuracy: 85 },
    ])
  })

  it('returns a single-point series when only one completed session has a summary', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const summaries = new Map<string, SessionSummaryResponseDto>([['s-1', makeSummary(66)]])

    const result = useAccuracySeries(sessions, summaries)

    expect(result).toEqual([{ sessionId: 's-1', accuracy: 66 }])
  })
})
