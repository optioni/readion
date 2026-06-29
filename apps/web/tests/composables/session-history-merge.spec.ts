import { describe, expect, it } from 'vitest'
import { useSessionHistoryMerge } from '~/composables/useSessionHistoryMerge'
import type {
  MockExamResponseDto,
  SessionResponseDto,
  SessionSummaryResponseDto,
} from '~~/src/api/model'

const makeSession = (
  id: string,
  startedAt: string,
  opts: { status?: string; kind?: string; durationMinutes?: number } = {},
): SessionResponseDto => ({
  id,
  userCertificationId: 'uc-1',
  kind: (opts.kind ?? 'study') as unknown as SessionResponseDto['kind'],
  status: (opts.status ?? 'completed') as unknown as SessionResponseDto['status'],
  durationMinutes: opts.durationMinutes ?? 30,
  contentMix: 'balanced',
  difficulty: 'medium',
  focusArea: 'general' as unknown as SessionResponseDto['focusArea'],
  learningStyle: 'visual',
  lastItemIndex: 0,
  startedAt,
})

const makeMockExam = (
  id: string,
  startedAt: string | null,
  opts: { type?: string; status?: string; score?: number | null } = {},
): MockExamResponseDto => ({
  id,
  userCertificationId: 'uc-1',
  type: (opts.type ?? 'mock') as unknown as MockExamResponseDto['type'],
  status: (opts.status ?? 'submitted') as unknown as MockExamResponseDto['status'],
  generation: 'generated' as unknown as MockExamResponseDto['generation'],
  startedAt: startedAt as unknown as MockExamResponseDto['startedAt'],
  score: (opts.score !== undefined ? opts.score : null) as unknown as MockExamResponseDto['score'],
  passed: null,
  domainBreakdown: {} as MockExamResponseDto['domainBreakdown'],
  questions: [],
})

const makeSummary = (
  questionsAnswered: number,
  accuracy: number,
  readinessDelta: number | null,
): SessionSummaryResponseDto => ({
  questionsAnswered,
  accuracy,
  domains: [],
  weakAreaDeltas: [],
  readiness: {
    before: null,
    after: null,
    delta: readinessDelta as unknown as SessionSummaryResponseDto['readiness']['delta'],
  },
})

describe('useSessionHistoryMerge', () => {
  it('returns an empty array when there are no sessions or mock exams', () => {
    const result = useSessionHistoryMerge([], [], new Map())
    expect(result).toEqual([])
  })

  it('merges sessions and mock exams sorted by startedAt descending (most recent first)', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const mocks = [makeMockExam('m-1', '2026-01-03T10:00:00Z')]
    const summaries = new Map<string, SessionSummaryResponseDto>()

    const result = useSessionHistoryMerge(sessions, mocks, summaries)

    expect(result.map((r) => r.id)).toEqual(['m-1', 's-1'])
  })

  it('populates questionsAnswered, accuracy, and readinessDelta from the summary for a completed session', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    // Summary accuracy is a 0-1 fraction from the API; the merge composable scales it to 0-100.
    const summaries = new Map([['s-1', makeSummary(12, 0.83, 5)]])

    const [row] = useSessionHistoryMerge(sessions, [], summaries)

    expect(row!.questionsAnswered).toBe(12)
    expect(row!.accuracy).toBe(83)
    expect(row!.readinessDelta).toBe(5)
  })

  it('sets questionsAnswered/accuracy/readinessDelta to null when a session has no summary', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z', { status: 'active' })]
    const summaries = new Map<string, SessionSummaryResponseDto>()

    const [row] = useSessionHistoryMerge(sessions, [], summaries)

    expect(row!.questionsAnswered).toBe(null)
    expect(row!.accuracy).toBe(null)
    expect(row!.readinessDelta).toBe(null)
  })

  it('sets kind from the session kind field for study/review sessions', () => {
    const sessions = [
      makeSession('s-1', '2026-01-02T10:00:00Z', { kind: 'study' }),
      makeSession('s-2', '2026-01-01T10:00:00Z', { kind: 'review' }),
    ]
    const result = useSessionHistoryMerge(sessions, [], new Map())

    expect(result[0]!.kind).toBe('study')
    expect(result[1]!.kind).toBe('review')
  })

  it('sets kind from the mock exam type for mock/diagnostic attempts', () => {
    const mocks = [
      makeMockExam('m-1', '2026-01-02T10:00:00Z', { type: 'mock' }),
      makeMockExam('m-2', '2026-01-01T10:00:00Z', { type: 'diagnostic' }),
    ]
    const result = useSessionHistoryMerge([], mocks, new Map())

    expect(result[0]!.kind).toBe('mock')
    expect(result[1]!.kind).toBe('diagnostic')
  })

  it('populates score for mock exam rows and leaves it null for study sessions', () => {
    const sessions = [makeSession('s-1', '2026-01-02T10:00:00Z')]
    const mocks = [makeMockExam('m-1', '2026-01-01T10:00:00Z', { score: 78 })]
    const result = useSessionHistoryMerge(sessions, mocks, new Map())

    const studyRow = result.find((r) => r.id === 's-1')
    const mockRow = result.find((r) => r.id === 'm-1')

    expect(studyRow?.score).toBe(null)
    expect(mockRow?.score).toBe(78)
  })

  it('places mock exams with null startedAt at the end of the sorted list', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    const mocks = [makeMockExam('m-1', null)]
    const result = useSessionHistoryMerge(sessions, mocks, new Map())

    expect(result[result.length - 1]!.id).toBe('m-1')
  })

  it('sets readinessDelta to null when summary readiness.delta is null', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z')]
    // Accuracy is a 0-1 fraction from the API.
    const summaries = new Map([['s-1', makeSummary(10, 0.8, null)]])

    const [row] = useSessionHistoryMerge(sessions, [], summaries)

    expect(row!.readinessDelta).toBe(null)
  })

  it('exposes session durationMinutes on study/review rows', () => {
    const sessions = [makeSession('s-1', '2026-01-01T10:00:00Z', { durationMinutes: 45 })]
    const [row] = useSessionHistoryMerge(sessions, [], new Map())

    expect(row!.durationMinutes).toBe(45)
  })
})
