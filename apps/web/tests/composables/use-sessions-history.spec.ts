import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSessionsHistory } from '~/composables/useSessionsHistory'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/sessions/sessions')
vi.mock('~~/src/api/session-summary/session-summary')

const session = (overrides: {
  id: string
  status: string
  kind?: string
  startedAt?: string
  focusArea?: string
  durationMinutes?: number
}) => ({
  id: overrides.id,
  userCertificationId: 'enr-1',
  kind: overrides.kind ?? 'study',
  status: overrides.status,
  durationMinutes: overrides.durationMinutes ?? 30,
  contentMix: 'mixed',
  difficulty: 'standard',
  focusArea: overrides.focusArea ?? 'Networking',
  learningStyle: 'reading',
  lastItemIndex: 0,
  startedAt: overrides.startedAt ?? '2026-06-20T00:00:00Z',
})

const sessionsEnvelope = <T>(rows: T[], meta: { total: number; page: number; limit: number }) => ({
  data: { data: rows, meta },
  status: 200,
  headers: new Headers(),
})

const summaryEnvelope = (accuracy: number) => ({
  data: {
    data: {
      questionsAnswered: 10,
      accuracy,
      domains: [],
      weakAreaDeltas: [],
      readiness: { before: null, after: null, delta: null },
    },
  },
  status: 200,
  headers: new Headers(),
})

describe('useSessionsHistory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('maps the paginated session list and joins completed-row accuracy on the visible page', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [
          session({ id: 's1', status: 'completed', kind: 'study', focusArea: 'Networking' }),
          session({ id: 's2', status: 'abandoned', kind: 'review', focusArea: 'Storage' }),
        ],
        { total: 12, page: 1, limit: 10 },
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockImplementation(async (id: string) => {
      if (id !== 's1') {
        throw new Error(`unexpected summary fetch for ${id}`)
      }
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      return summaryEnvelope(0.82) as any
    })

    const { result } = renderComposable(() =>
      useSessionsHistory(ref('cert-1'), { page: ref(1), limit: ref(10) }),
    )

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(sessionsControllerList).toHaveBeenCalledWith({
      certificationId: 'cert-1',
      page: 1,
      limit: 10,
    })
    expect(result.rows.value).toEqual([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        kind: 'study',
        focusArea: 'Networking',
        durationMinutes: 30,
        status: 'completed',
        accuracy: 0.82,
      },
      {
        id: 's2',
        date: '2026-06-20T00:00:00Z',
        kind: 'review',
        focusArea: 'Storage',
        durationMinutes: 30,
        status: 'abandoned',
        accuracy: null,
      },
    ])
    expect(result.total.value).toBe(12)
  })

  it('does not fetch summaries while the certification id is unknown', async () => {
    const { result } = renderComposable(() =>
      useSessionsHistory(ref(null), { page: ref(1), limit: ref(10) }),
    )

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(sessionsControllerList).not.toHaveBeenCalled()
    expect(result.rows.value).toEqual([])
  })

  it('leaves accuracy null when a completed-row summary fetch fails', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [session({ id: 's1', status: 'completed', focusArea: 'Networking' })],
        { total: 1, page: 1, limit: 10 },
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockRejectedValue(new Error('409 active'))

    const { result } = renderComposable(() =>
      useSessionsHistory(ref('cert-1'), { page: ref(1), limit: ref(10) }),
    )

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.rows.value[0]?.accuracy).toBeNull()
  })
})
