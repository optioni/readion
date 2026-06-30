import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import OverviewTab from '~/components/OverviewTab.vue'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import { useCardReadiness } from '~/composables/useCardReadiness'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { sessionSummaryControllerSummary } from '~~/src/api/session-summary/session-summary'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'

vi.mock('~~/src/api/sessions/sessions')
vi.mock('~~/src/api/session-summary/session-summary')
vi.mock('~/composables/useCardReadiness', () => ({ useCardReadiness: vi.fn() }))
vi.mock('~/composables/useCertWeakAreas', () => ({ useCertWeakAreas: vi.fn() }))
vi.mock('~/composables/useCardDueReviews', () => ({ useCardDueReviews: vi.fn() }))

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

const summaryEnvelope = (accuracy: number, nextFocus: unknown) => ({
  data: {
    data: {
      questionsAnswered: 10,
      accuracy,
      domains: [],
      weakAreaDeltas: [],
      readiness: { before: null, after: null, delta: null },
      nextFocus,
    },
  },
  status: 200,
  headers: new Headers(),
})

function stubOtherCards() {
  vi.mocked(useCardReadiness).mockReturnValue({
    readiness: computed(() => ({ calibrated: true, score: 72, trajectory: null })),
    isLoading: ref(false),
    isError: ref(false),
  })
  vi.mocked(useCertWeakAreas).mockReturnValue({
    weakAreas: computed(() => []),
    isLoading: ref(false),
    isError: ref(false),
  })
  vi.mocked(useCardDueReviews).mockReturnValue({
    dueCount: computed(() => 0),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function mountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(OverviewTab, {
    props: { enrollmentId: 'enr-1', certificationId: 'cert-1', domains: [] },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

describe('CertDetail Overview recent sessions (acceptance)', () => {
  beforeEach(() => {
    stubOtherCards()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a readable label from the session type/focus and the real score, never [object Object]', async () => {
    vi.mocked(sessionsControllerList).mockResolvedValue(
      sessionsEnvelope(
        [
          session({
            id: 's1',
            status: 'completed',
            startedAt: '2026-06-20T00:00:00Z',
            focusArea: { mode: 'domains', domains: ['IAM'] },
          }),
        ],
        1,
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ) as any,
    )
    vi.mocked(sessionSummaryControllerSummary).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      summaryEnvelope(0.8, null) as any,
    )

    const wrapper = mountTab()

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-testid="recent-session-row"]').length).toBeGreaterThan(0)
    })
    await flushPromises()

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.text()).not.toContain('[object Object]')
    expect(row.text()).toContain('80%')
    expect(row.text()).toContain('IAM')
  })
})
