import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOverviewSessions } from '~/composables/useOverviewSessions'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/sessions/sessions')
vi.mock('~~/src/api/session-summary/session-summary')

const session = (overrides: {
  id: string
  status: string
  startedAt: string
  focusArea: unknown
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

const sessionsEnvelope = <T>(rows: T[], total: number) => ({
  data: { data: rows, meta: { total, page: 1, limit: 3 } },
  status: 200,
  headers: new Headers(),
})

const summaryEnvelope = (
  accuracy: number,
  nextFocus: unknown,
  weakAreaDeltas: Array<{ domain: string; delta: number }> = [],
) => ({
  data: {
    data: {
      questionsAnswered: 10,
      accuracy,
      domains: [],
      weakAreaDeltas,
      readiness: { before: null, after: null, delta: null },
      nextFocus,
    },
  },
  status: 200,
  headers: new Headers(),
})

describe('useOverviewSessions', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('joins accuracy, exposes the total count and the latest completed nextFocus domain', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [
          session({
            id: 's1',
            status: 'completed',
            startedAt: '2026-06-20T00:00:00Z',
            focusArea: { mode: 'domains', domains: ['Networking'] },
          }),
          session({
            id: 's2',
            status: 'abandoned',
            startedAt: '2026-06-19T00:00:00Z',
            focusArea: { mode: 'auto' },
          }),
        ],
        7,
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      summaryEnvelope(0.8, { domain: 'Networking' }) as any,
    )

    const { result } = renderComposable(() => useOverviewSessions('cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(sessionsControllerList).toHaveBeenCalledWith({ certificationId: 'cert-1', limit: 3 })
    expect(result.sessions.value).toEqual([
      { id: 's1', date: '2026-06-20T00:00:00Z', label: 'Study · Networking', accuracy: 0.8 },
      { id: 's2', date: '2026-06-19T00:00:00Z', label: 'Study · All domains', accuracy: null },
    ])
    expect(result.totalSessions.value).toBe(7)
    expect(result.nextFocusDomain.value).toBe('Networking')
  })

  it('exposes the latest completed summary and the raw session focus areas for client-side derivation', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [
          session({
            id: 's1',
            status: 'completed',
            startedAt: '2026-06-20T00:00:00Z',
            focusArea: { mode: 'domains', domains: ['Networking'] },
          }),
          session({
            id: 's2',
            status: 'abandoned',
            startedAt: '2026-06-19T00:00:00Z',
            focusArea: 'auto',
          }),
        ],
        7,
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(
      summaryEnvelope(0.8, { domain: 'Networking' }, [
        { domain: 'Networking', delta: 7 },
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )

    const { result } = renderComposable(() => useOverviewSessions('cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.latestSummary.value).toMatchObject({
      weakAreaDeltas: [{ domain: 'Networking', delta: 7 }],
    })
    expect(result.sessionFocusAreas.value).toEqual([
      { startedAt: '2026-06-20T00:00:00Z', focusArea: { mode: 'domains', domains: ['Networking'] } },
      { startedAt: '2026-06-19T00:00:00Z', focusArea: 'auto' },
    ])
  })

  it('narrows a missing or non-string nextFocus domain to null', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [
          session({
            id: 's1',
            status: 'completed',
            startedAt: '2026-06-20T00:00:00Z',
            focusArea: 'Networking',
          }),
        ],
        1,
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      summaryEnvelope(0.7, null) as any,
    )

    const { result } = renderComposable(() => useOverviewSessions('cert-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.nextFocusDomain.value).toBeNull()
  })

  it('stays disabled until a certification id is known', () => {
    const { result } = renderComposable(() => useOverviewSessions(null))

    expect(sessionsControllerList).not.toHaveBeenCalled()
    expect(result.sessions.value).toEqual([])
    expect(result.totalSessions.value).toBe(0)
    expect(result.nextFocusDomain.value).toBeNull()
    expect(result.latestSummary.value).toBeNull()
    expect(result.sessionFocusAreas.value).toEqual([])
  })
})
