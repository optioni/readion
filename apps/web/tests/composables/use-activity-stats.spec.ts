import { describe, expect, it } from 'vitest'
import { useActivityStats } from '~/composables/useActivityStats'
import type { SessionResponseDto, SessionSummaryResponseDto } from '~~/src/api/model'

const makeSession = (
  id: string,
  startedAt: string,
  durationMinutes = 60,
  status = 'completed',
  kind = 'study',
): SessionResponseDto =>
  ({
    id,
    userCertificationId: 'uc-1',
    kind,
    status,
    durationMinutes,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
    lastItemIndex: 0,
    startedAt,
  }) as unknown as SessionResponseDto

const makeSummary = (questionsAnswered: number): SessionSummaryResponseDto =>
  ({
    questionsAnswered,
    accuracy: 0.8,
    domains: [],
    weakAreaDeltas: [],
    readiness: { before: 60, after: 70, delta: 10 },
  }) as unknown as SessionSummaryResponseDto

describe('useActivityStats', () => {
  describe('sessionCount', () => {
    it('counts all sessions in the list', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z'),
        makeSession('s2', '2026-06-02T09:00:00.000Z'),
        makeSession('s3', '2026-06-03T09:00:00.000Z'),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.sessionCount).toBe(3)
    })

    it('returns 0 when session list is empty', () => {
      const stats = useActivityStats([], new Map())
      expect(stats.sessionCount).toBe(0)
    })
  })

  describe('questionsAnswered', () => {
    it('sums questionsAnswered from all completed-session summaries', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z'),
        makeSession('s2', '2026-06-02T09:00:00.000Z'),
        makeSession('s3', '2026-06-03T09:00:00.000Z'),
      ]
      const summariesMap = new Map([
        ['s1', makeSummary(8)],
        ['s2', makeSummary(8)],
        ['s3', makeSummary(8)],
      ])
      const stats = useActivityStats(sessions, summariesMap)
      expect(stats.questionsAnswered).toBe(24)
    })

    it('returns 0 when no summaries are present', () => {
      const sessions = [makeSession('s1', '2026-06-01T09:00:00.000Z')]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.questionsAnswered).toBe(0)
    })

    it('returns 0 when session list is empty', () => {
      const stats = useActivityStats([], new Map())
      expect(stats.questionsAnswered).toBe(0)
    })
  })

  describe('studyTimeLabel', () => {
    it('formats duration as hours and minutes when both are non-zero', () => {
      const sessions = [makeSession('s1', '2026-06-01T09:00:00.000Z', 372)]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.studyTimeLabel).toBe('6h 12m')
    })

    it('formats duration as minutes only when under one hour', () => {
      const sessions = [makeSession('s1', '2026-06-01T09:00:00.000Z', 58)]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.studyTimeLabel).toBe('58m')
    })

    it('formats duration as hours only when minutes remainder is zero', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z', 60),
        makeSession('s2', '2026-06-02T09:00:00.000Z', 60),
        makeSession('s3', '2026-06-03T09:00:00.000Z', 60),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.studyTimeLabel).toBe('3h')
    })

    it('returns "0m" when total duration is zero', () => {
      const stats = useActivityStats([], new Map())
      expect(stats.studyTimeLabel).toBe('0m')
    })

    it('sums durationMinutes across all sessions', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z', 30),
        makeSession('s2', '2026-06-02T09:00:00.000Z', 45),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.studyTimeLabel).toBe('1h 15m')
    })
  })

  describe('currentStreakDays', () => {
    it('returns 1 when all sessions are on non-consecutive days', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z'),
        makeSession('s2', '2026-06-10T09:00:00.000Z'),
        makeSession('s3', '2026-06-20T09:00:00.000Z'),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.currentStreakDays).toBe(1)
    })

    it('returns the count of consecutive days ending on the latest active day', () => {
      const sessions = [
        makeSession('s1', '2026-06-18T09:00:00.000Z'),
        makeSession('s2', '2026-06-19T09:00:00.000Z'),
        makeSession('s3', '2026-06-20T09:00:00.000Z'),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.currentStreakDays).toBe(3)
    })

    it('resets streak at a gap even when earlier consecutive days exist', () => {
      const sessions = [
        makeSession('s1', '2026-06-01T09:00:00.000Z'),
        makeSession('s2', '2026-06-02T09:00:00.000Z'),
        makeSession('s4', '2026-06-10T09:00:00.000Z'),
        makeSession('s5', '2026-06-11T09:00:00.000Z'),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.currentStreakDays).toBe(2)
    })

    it('counts multiple sessions on the same day as one streak day', () => {
      const sessions = [
        makeSession('s1', '2026-06-19T08:00:00.000Z'),
        makeSession('s2', '2026-06-19T14:00:00.000Z'),
        makeSession('s3', '2026-06-20T09:00:00.000Z'),
      ]
      const stats = useActivityStats(sessions, new Map())
      expect(stats.currentStreakDays).toBe(2)
    })

    it('returns 0 when there are no sessions', () => {
      const stats = useActivityStats([], new Map())
      expect(stats.currentStreakDays).toBe(0)
    })
  })
})
