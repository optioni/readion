import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { completeSessionItem, endSession, fetchSessionDetail } from '~/composables/sessionViewApi'
import { useCertDetail } from '~/composables/useCertDetail'
import SessionViewPage from '~/pages/sessions/[id]/index.vue'

vi.mock('~/composables/sessionViewApi', () => ({
  fetchSessionDetail: vi.fn(),
  completeSessionItem: vi.fn(),
  endSession: vi.fn(),
}))
vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))

vi.stubGlobal('useRoute', () => ({ params: { id: 'sess-1' } }))
vi.stubGlobal('definePageMeta', vi.fn())
const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

interface ItemShape {
  index: number
  type: string
  content: string
  completed: boolean
  sourceChunkIds: string[]
  supportingSpans: string[]
}

function readingItem(index: number, completed = false): ItemShape {
  return {
    index,
    type: 'reading',
    content: `reading-${index}`,
    completed,
    sourceChunkIds: [],
    supportingSpans: [],
  }
}

function quizItem(index: number, completed = false): ItemShape {
  return {
    index,
    type: 'quiz',
    content: JSON.stringify({ questionId: `q-${index}`, question: '?', options: ['a', 'b'] }),
    completed,
    sourceChunkIds: [],
    supportingSpans: [],
  }
}

function detail(items: ItemShape[], overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'sess-1',
      userCertificationId: 'enr-1',
      kind: 'study',
      status: 'active',
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: { mode: 'auto' },
      learningStyle: 'weak-area-focus',
      lastItemIndex: 0,
      startedAt: '2026-06-29T00:00:00.000Z',
      endedAt: null,
      items,
      ...overrides,
    },
    relationships: { items: { href: '/x', data: [] } },
  }
}

function stubSession(items: ItemShape[], overrides: Record<string, unknown> = {}) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchSessionDetail).mockResolvedValue(detail(items, overrides) as any)
}

function stubCert() {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => 'Solutions Architect – Associate'),
    provider: computed(() => 'AWS'),
    code: computed(() => 'SAA-C03'),
    certificationId: computed(() => 'cert-1'),
    domains: computed(() => []),
    isLoading: computed(() => false),
    isError: computed(() => false),
    notFound: computed(() => false),
  })
}

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(SessionViewPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        ReadingBlock: {
          props: ['item', 'sessionId', 'domain'],
          template:
            '<div data-testid="reading-stub" @click="$emit(\'advance\', item.index)">reading {{ item.index }}</div>',
        },
        QuizCard: {
          props: ['item', 'sessionId', 'userCertificationId'],
          template:
            '<div data-testid="quiz-stub" :data-uc="userCertificationId" @click="$emit(\'advance\', item.index)">quiz {{ item.index }}</div>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubCert()
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(completeSessionItem).mockResolvedValue({} as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(endSession).mockResolvedValue({} as any)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Session view page shell', () => {
  it('loads the session and renders the split-panel shell', async () => {
    stubSession([readingItem(0)])
    const wrapper = mountPage()
    await flushPromises()

    expect(fetchSessionDetail).toHaveBeenCalledWith('sess-1')
    expect(wrapper.find('[data-testid="session-view-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-split-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-panel"]').exists()).toBe(true)
  })

  it('renders a loading state before the session resolves', () => {
    stubSession([readingItem(0)])
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="session-view-loading"]').exists()).toBe(true)
  })

  it('renders an error state when the session fails to load', async () => {
    vi.mocked(fetchSessionDetail).mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="session-view-error"]').exists()).toBe(true)
  })
})

describe('Session view resume behaviour', () => {
  it('resumes at the first incomplete item', async () => {
    stubSession(
      [
        readingItem(0, true),
        readingItem(1, true),
        readingItem(2, true),
        readingItem(3, true),
        readingItem(4, true),
        readingItem(5, false),
      ],
      { lastItemIndex: 5 },
    )
    const wrapper = mountPage()
    await flushPromises()

    const content = wrapper.find('[data-testid="session-content"]')
    expect(content.text()).toContain('reading 5')
    expect(content.text()).not.toContain('reading 0')
  })

  it('renders a quiz card with the session certification id for quiz items', async () => {
    stubSession([quizItem(0)])
    const wrapper = mountPage()
    await flushPromises()

    const quiz = wrapper.find('[data-testid="quiz-stub"]')
    expect(quiz.exists()).toBe(true)
    expect(quiz.attributes('data-uc')).toBe('enr-1')
  })
})

describe('Session view progress and advancing', () => {
  it('shows completed/total progress reflecting completed flags', async () => {
    stubSession([readingItem(0, true), readingItem(1, true), readingItem(2, false)])
    const wrapper = mountPage()
    await flushPromises()

    const progress = wrapper.find('[data-testid="session-progress"]')
    expect(progress.text()).toContain('2')
    expect(progress.text()).toContain('3')
  })

  it('completes the current item and advances to the next on advance', async () => {
    stubSession([readingItem(0), readingItem(1), readingItem(2)])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="session-content"]').text()).toContain('reading 0')

    await wrapper.find('[data-testid="reading-stub"]').trigger('click')
    await flushPromises()

    expect(completeSessionItem).toHaveBeenCalledWith('sess-1', 0)
    expect(wrapper.find('[data-testid="session-content"]').text()).toContain('reading 1')
    expect(wrapper.find('[data-testid="session-progress"]').text()).toContain('1')
  })
})

describe('Session view end session', () => {
  it('ends the session and navigates to the summary', async () => {
    stubSession([readingItem(0)])
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="end-session-button"]').trigger('click')
    await flushPromises()

    expect(endSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/sess-1/summary')
  })
})

describe('Session view live timer', () => {
  it('renders the elapsed time counting up from startedAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T00:02:05.000Z'))
    try {
      stubSession([readingItem(0)], { startedAt: '2026-06-29T00:00:00.000Z' })
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.find('[data-testid="session-timer"]').text()).toBe('02:05')

      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-testid="session-timer"]').text()).toBe('03:05')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Session view agent panel', () => {
  it('collapses and expands the agent panel', async () => {
    stubSession([readingItem(0)])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-panel"]').attributes('data-collapsed')).toBe('false')
    await wrapper.find('[data-testid="agent-panel-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="agent-panel"]').attributes('data-collapsed')).toBe('true')
  })
})
