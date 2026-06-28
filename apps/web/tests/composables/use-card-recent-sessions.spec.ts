import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCardRecentSessions } from '~/composables/useCardRecentSessions'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/sessions/sessions')
vi.mock('~~/src/api/session-summary/session-summary')

const session = (overrides: {
  id: string
  status: string
  startedAt: string
  focusArea: string
}) => ({
  id: overrides.id,
  userCertificationId: 'enr-1',
  kind: 'study',
  status: overrides.status,
  durationMinutes: 30,
  contentMix: 'mixed',
  difficulty: 'standard',
  focusArea: overrides.focusArea,
  learningStyle: 'reading',
  lastItemIndex: 0,
  startedAt: overrides.startedAt,
})

const sessionsEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

const summaryEnvelope = (accuracy: number, delta: number | null) => ({
  data: {
    data: {
      questionsAnswered: 10,
      accuracy,
      domains: [],
      weakAreaDeltas: [],
      readiness: { before: null, after: null, delta },
    },
  },
  status: 200,
  headers: new Headers(),
})

describe('useCardRecentSessions', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the 3 most recent sessions and joins completed-session accuracy + last readiness delta', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope([
        session({
          id: 's1',
          status: 'completed',
          startedAt: '2026-06-20T00:00:00Z',
          focusArea: 'Networking',
        }),
        session({
          id: 's2',
          status: 'abandoned',
          startedAt: '2026-06-19T00:00:00Z',
          focusArea: 'Storage',
        }),
        session({
          id: 's3',
          status: 'completed',
          startedAt: '2026-06-18T00:00:00Z',
          focusArea: 'Security',
        }),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )
    const summariesById: Record<string, ReturnType<typeof summaryEnvelope>> = {
      s1: summaryEnvelope(0.8, 5),
      s3: summaryEnvelope(0.6, 3),
    }
    vi.mocked(sessionSummaryControllerSummary).mockImplementation(async (id: string) => {
      const summary = summariesById[id]
      if (!summary) {
        throw new Error(`unexpected summary fetch for ${id}`)
      }
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      return summary as any
    })

    const { result } = renderComposable(() => useCardRecentSessions('enr-1', 'cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(sessionsControllerList).toHaveBeenCalledWith({ certificationId: 'cert-1', limit: 3 })
    expect(result.sessions.value).toEqual([
      { id: 's1', date: '2026-06-20T00:00:00Z', label: 'Networking', accuracy: 0.8 },
      { id: 's2', date: '2026-06-19T00:00:00Z', label: 'Storage', accuracy: null },
      { id: 's3', date: '2026-06-18T00:00:00Z', label: 'Security', accuracy: 0.6 },
    ])
    expect(result.readinessDelta.value).toBe(5)
  })

  it('exposes a null readiness delta when the latest completed session has none', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope([
        session({
          id: 's1',
          status: 'completed',
          startedAt: '2026-06-20T00:00:00Z',
          focusArea: 'Networking',
        }),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      summaryEnvelope(0.7, null) as any,
    )

    const { result } = renderComposable(() => useCardRecentSessions('enr-1', 'cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.readinessDelta.value).toBeNull()
  })

  it('degrades to empty sessions and null delta when the request fails', async () => {
    vi.mocked(sessionsControllerList).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCardRecentSessions('enr-1', 'cert-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.sessions.value).toEqual([])
    expect(result.readinessDelta.value).toBeNull()
  })

  it('falls back to null accuracy when a completed session summary is unavailable', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope([
        session({
          id: 's1',
          status: 'completed',
          startedAt: '2026-06-20T00:00:00Z',
          focusArea: 'Networking',
        }),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockRejectedValue(new Error('no summary'))

    const { result } = renderComposable(() => useCardRecentSessions('enr-1', 'cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.sessions.value).toEqual([
      { id: 's1', date: '2026-06-20T00:00:00Z', label: 'Networking', accuracy: null },
    ])
    expect(result.readinessDelta.value).toBeNull()
  })
})
