import { describe, expect, it } from 'vitest'
import { useReadinessTrend } from '~/composables/useReadinessTrend'
import type {
  ReadinessResponseDto,
  SessionResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'

const makeSession = (id: string, startedAt: string, status = 'completed'): SessionResponseDto => ({
  id,
  userCertificationId: 'uc-1',
  kind: 'study' as unknown as SessionResponseDto['kind'],
  status: status as unknown as SessionResponseDto['status'],
  durationMinutes: 30,
  contentMix: 'balanced',
  difficulty: 'medium',
  focusArea: 'general' as unknown as SessionResponseDto['focusArea'],
  learningStyle: 'visual',
  lastItemIndex: 0,
  startedAt,
})

const makeSummary = (readinessAfter: number | null = 70): SessionSummaryResponseDto => ({
  questionsAnswered: 10,
  accuracy: 80,
  domains: [],
  weakAreaDeltas: [],
  readiness: {
    before: 60 as unknown as SessionSummaryResponseDto['readiness']['before'],
    after: readinessAfter as unknown as SessionSummaryResponseDto['readiness']['after'],
    delta: 10 as unknown as SessionSummaryResponseDto['readiness']['delta'],
  },
})

const makeReadiness = (calibrated: boolean, score: number | null): ReadinessResponseDto => ({
  calibrated,
  score,
  trajectory: null,
})

describe('useReadinessTrend', () => {
  it('returns empty trend when the enrollment is not calibrated', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const summaries = new Map([['s-1', makeSummary(65)]])
    const readiness = makeReadiness(false, null)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result).toEqual({ points: [], hasData: false })
  })

  it('returns empty trend when score is null even if calibrated is true', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const summaries = new Map([['s-1', makeSummary(65)]])
    const readiness = makeReadiness(true, null)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result).toEqual({ points: [], hasData: false })
  })

  it('returns only the current score when no session summaries are available', () => {
    const sessions: SessionResponseDto[] = []
    const summaries = new Map<string, SessionSummaryResponseDto>()
    const readiness = makeReadiness(true, 72)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result).toEqual({ points: [{ score: 72, label: 'Today' }], hasData: true })
  })

  it('builds points from session summaries in chronological order, ending at the current score', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-03T10:00:00Z'),
      makeSession('s-3', '2026-01-05T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(60)],
      ['s-2', makeSummary(68)],
      ['s-3', makeSummary(74)],
    ])
    const readiness = makeReadiness(true, 78)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.hasData).toBe(true)
    expect(result.points.map((p) => p.score)).toEqual([60, 68, 74, 78])
    expect(result.points.map((p) => p.label)).toEqual(['Jan 1', 'Jan 3', 'Jan 5', 'Today'])
  })

  it('excludes sessions without summaries from the trend points', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-03T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(60)],
      // s-2 has no summary
    ])
    const readiness = makeReadiness(true, 65)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.points.map((p) => p.score)).toEqual([60, 65])
  })

  it('sorts sessions chronologically even when provided out of order', () => {
    const sessions = [
      makeSession('s-3', '2026-01-05T10:00:00Z'),
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-03T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(60)],
      ['s-2', makeSummary(68)],
      ['s-3', makeSummary(74)],
    ])
    const readiness = makeReadiness(true, 78)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.points.map((p) => p.score)).toEqual([60, 68, 74, 78])
  })

  it('ignores non-completed sessions when building the trend', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z', 'completed'),
      makeSession('s-2', '2026-01-02T10:00:00Z', 'active'),
      makeSession('s-3', '2026-01-03T10:00:00Z', 'abandoned'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(60)],
      ['s-2', makeSummary(70)],
      ['s-3', makeSummary(80)],
    ])
    const readiness = makeReadiness(true, 65)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.points.map((p) => p.score)).toEqual([60, 65])
  })

  it('handles a single completed session (single-session case)', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const summaries = new Map([['s-1', makeSummary(55)]])
    const readiness = makeReadiness(true, 60)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.points.map((p) => p.score)).toEqual([55, 60])
    expect(result.hasData).toBe(true)
  })

  it('skips a summary when readiness.after is null', () => {
    const sessions = [
      makeSession('s-1', '2026-01-01T10:00:00Z'),
      makeSession('s-2', '2026-01-02T10:00:00Z'),
    ]
    const summaries = new Map<string, SessionSummaryResponseDto>([
      ['s-1', makeSummary(null)],
      ['s-2', makeSummary(70)],
    ])
    const readiness = makeReadiness(true, 75)

    const result = useReadinessTrend(sessions, summaries, readiness)

    expect(result.points.map((p) => p.score)).toEqual([70, 75])
  })
})
