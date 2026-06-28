import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drillSession, fetchSessionDetail, fetchSessionSummary } from '~/composables/sessionViewApi'
import SessionSummaryPage from '~/pages/sessions/[id]/summary.vue'

vi.mock('~/composables/sessionViewApi', () => ({
  fetchSessionSummary: vi.fn(),
  fetchSessionDetail: vi.fn(),
  drillSession: vi.fn(),
}))

vi.stubGlobal('useRoute', () => ({ params: { id: 'sess-1' } }))
vi.stubGlobal('definePageMeta', vi.fn())
const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

function summaryDto(overrides: Record<string, unknown> = {}) {
  return {
    questionsAnswered: 12,
    accuracy: 0.67,
    domains: [{ domain: 'IAM & Security', accuracy: 0.8 }],
    weakAreaDeltas: [{ domain: 'IAM & Security', delta: 7 }],
    readiness: { before: 72, after: 75, delta: 3 },
    strongestQuestion: { responseId: 'resp-strong', question: 'Strongest?' },
    weakestQuestion: { responseId: 'resp-weak', question: 'Weakest?' },
    nextFocus: { domain: 'Networking' },
    ...overrides,
  }
}

function sessionDto(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'sess-1',
      userCertificationId: 'enr-1',
      startedAt: '2026-06-29T00:00:00.000Z',
      endedAt: '2026-06-29T00:20:34.000Z',
      items: [],
      ...overrides,
    },
  }
}

function stubSummary(overrides: Record<string, unknown> = {}) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchSessionSummary).mockResolvedValue(summaryDto(overrides) as any)
}

function stubSession(overrides: Record<string, unknown> = {}) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchSessionDetail).mockResolvedValue(sessionDto(overrides) as any)
}

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(SessionSummaryPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        SessionSummaryBody: {
          props: ['summary', 'timeLabel', 'drillNoMisses'],
          template: `<div
            data-testid="body-stub"
            :data-acc="summary.accuracy"
            :data-time="timeLabel"
            :data-nomiss="drillNoMisses"
          >
            <button data-testid="stub-drill" @click="$emit('drill')">drill</button>
            <button data-testid="stub-ask" @click="$emit('ask-agent','resp-9')">ask</button>
            <button data-testid="stub-back" @click="$emit('back')">back</button>
          </div>`,
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubSummary()
  stubSession()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Session summary page load', () => {
  it('fetches the summary and renders the body with the normalized summary', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(fetchSessionSummary).toHaveBeenCalledWith('sess-1')
    expect(wrapper.find('[data-testid="session-summary-page"]').exists()).toBe(true)
    const body = wrapper.find('[data-testid="body-stub"]')
    expect(body.exists()).toBe(true)
    expect(body.attributes('data-acc')).toBe('0.67')
  })

  it('derives a time label from the session start and end timestamps', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(fetchSessionDetail).toHaveBeenCalledWith('sess-1')
    expect(wrapper.find('[data-testid="body-stub"]').attributes('data-time')).toBe('20m 34s')
  })

  it('renders a loading state before the summary resolves', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="session-summary-loading"]').exists()).toBe(true)
  })

  it('renders an error state when the summary fails to load', async () => {
    vi.mocked(fetchSessionSummary).mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="session-summary-error"]').exists()).toBe(true)
  })
})

describe('Session summary drill action', () => {
  it('navigates to the new drill session when a drill starts', async () => {
    vi.mocked(drillSession).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
      { status: 'started', session: { id: 'drill-1' } } as any,
    )
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="stub-drill"]').trigger('click')
    await flushPromises()

    expect(drillSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/drill-1')
  })

  it('shows the empty state without navigating when there are no misses', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    vi.mocked(drillSession).mockResolvedValue({ status: 'no_misses' } as any)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="stub-drill"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="body-stub"]').attributes('data-nomiss')).toBe('true')
  })
})

describe('Session summary secondary actions', () => {
  it('navigates back to the dashboard on back', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="stub-back"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('routes the ask-agent action back to the session carrying the responseId', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="stub-ask"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).toHaveBeenCalledWith({
      path: '/sessions/sess-1',
      query: { explain: 'resp-9' },
    })
  })
})
