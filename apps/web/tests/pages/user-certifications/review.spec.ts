import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchReviewQueue, gradeReviewItem, startReview } from '~/composables/progressApi'
import {
  completeSessionItem,
  drillSession,
  endSession,
  fetchSessionDetail,
  fetchSessionSummary,
} from '~/composables/sessionViewApi'
import ReviewPage from '~/pages/user-certifications/[id]/review.vue'

vi.mock('~/composables/progressApi', () => ({
  fetchReviewQueue: vi.fn(),
  startReview: vi.fn(),
  gradeReviewItem: vi.fn(),
}))

vi.mock('~/composables/sessionViewApi', () => ({
  fetchSessionDetail: vi.fn(),
  completeSessionItem: vi.fn(),
  endSession: vi.fn(),
  fetchSessionSummary: vi.fn(),
  drillSession: vi.fn(),
}))

vi.mock('~/composables/sessionSummaryMapper', () => ({
  toSummary: vi.fn((dto) => ({
    ...dto,
    readiness: {
      before: dto.readiness?.before ?? null,
      after: dto.readiness?.after ?? null,
      delta: dto.readiness?.delta ?? null,
    },
    weakAreaDeltas: dto.weakAreaDeltas ?? [],
    domains: dto.domains ?? [],
  })),
}))

let routeQuery: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ params: { id: 'enr-1' }, query: routeQuery }))
vi.stubGlobal('definePageMeta', vi.fn())
const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

function quizContent(questionId: string, question: string, options: string[]) {
  return JSON.stringify({ questionId, question, options, format: 'multiple_choice' })
}

function quizItem(index: number, completed = false) {
  return {
    index,
    type: 'quiz',
    content: quizContent(`q-${index}`, `Question ${index}?`, ['Option A', 'Option B']),
    completed,
    sourceChunkIds: [],
    supportingSpans: [],
  }
}

function sessionDetail(items: ReturnType<typeof quizItem>[], sessionId = 'sess-review') {
  return {
    data: {
      id: sessionId,
      userCertificationId: 'enr-1',
      kind: 'review',
      status: 'active',
      durationMinutes: 5,
      lastItemIndex: 0,
      startedAt: '2026-06-29T09:00:00.000Z',
      endedAt: null,
      items,
    },
    relationships: { items: { data: items.map((i) => ({ index: i.index })) } },
  }
}

function stubQueue(dueCount = 3, count = 3) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `ri-${i}`,
    userCertificationId: 'enr-1',
    anchorChunkId: `chunk-${i}`,
    domain: 'Secure Architectures',
    box: 1,
    state: 'due',
    dueAt: '2026-06-29T00:00:00.000Z',
    lastReviewedAt: null,
  }))
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchReviewQueue).mockResolvedValue({ items, meta: { dueCount, total: count } } as any)
}

function stubQueueEmpty() {
  vi.mocked(fetchReviewQueue).mockResolvedValue({
    items: [],
    meta: { dueCount: 0, total: 2 },
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  } as any)
}

function stubStartReview(sessionId = 'sess-review') {
  vi.mocked(startReview).mockResolvedValue({
    status: 'started',
    session: {
      id: sessionId,
      userCertificationId: 'enr-1',
      kind: 'review',
      status: 'active',
      startedAt: '2026-06-29T09:00:00.000Z',
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    } as any,
  })
}

function stubSessionDetail(items: ReturnType<typeof quizItem>[], sessionId = 'sess-review') {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchSessionDetail).mockResolvedValue(sessionDetail(items, sessionId) as any)
}

function stubSummary() {
  vi.mocked(fetchSessionSummary).mockResolvedValue({
    questionsAnswered: 3,
    accuracy: 0.8,
    domains: [{ domain: 'Secure Architectures', accuracy: 0.8 }],
    weakAreaDeltas: [{ domain: 'Secure Architectures', delta: 5 }],
    readiness: { before: 60, after: 64, delta: 4 },
    strongestQuestion: null,
    weakestQuestion: null,
    nextFocus: null,
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  } as any)
}

function mountPage() {
  return mount(ReviewPage, {
    global: {
      stubs: {
        QuizCard: {
          props: ['item', 'sessionId', 'userCertificationId'],
          template:
            '<div data-testid="quiz-card" @click="$emit(\'advance\', item.index)">quiz {{ item.index }}</div>',
          emits: ['advance'],
        },
        ReviewQueueEntry: {
          props: ['enrollmentId', 'items', 'dueCount'],
          template:
            '<div data-testid="review-queue-entry-stub"><button data-testid="start-review-button" @click="$emit(\'start\')">Start</button></div>',
          emits: ['start'],
        },
        ReviewCompletion: {
          props: ['summary', 'drillNoMisses'],
          template: `<div data-testid="session-summary-page">
            <div data-testid="summary-accuracy">80%</div>
            <button data-testid="drill-button" @click="$emit('drill')">Drill</button>
            <button data-testid="summary-back-button" @click="$emit('back')">Back</button>
          </div>`,
          emits: ['drill', 'back'],
        },
        ReviewHeader: {
          props: ['userCertificationId', 'current', 'total', 'timeStr', 'timeUrgent'],
          template:
            '<div data-testid="review-header-stub" :data-time-str="timeStr" :data-time-urgent="timeUrgent" />',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  routeQuery = {}
  stubQueue()
  stubStartReview()
  stubSessionDetail([quizItem(0)])
  stubSummary()
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(completeSessionItem).mockResolvedValue({} as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(endSession).mockResolvedValue({} as any)
  vi.mocked(gradeReviewItem).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Review page — queue scene', () => {
  it('loads the review queue on mount and shows the queue entry', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(fetchReviewQueue).toHaveBeenCalledWith('enr-1')
    expect(wrapper.find('[data-testid="review-queue-entry-stub"]').exists()).toBe(true)
  })

  it('shows the queue entry with all-caught-up when dueCount is 0', async () => {
    stubQueueEmpty()
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="review-queue-entry-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(false)
  })

  it('autostarts exactly once after the dashboard handoff queue has loaded', async () => {
    routeQuery = { autostart: '1' }
    const wrapper = mountPage()
    await flushPromises()

    expect(fetchReviewQueue).toHaveBeenCalledTimes(1)
    expect(startReview).toHaveBeenCalledTimes(1)
    expect(startReview).toHaveBeenCalledWith('enr-1')
    expect(wrapper.find('[data-testid="self-grade-card"]').exists()).toBe(true)
  })

  it('does not double-start when the queue start event fires during an autostart request', async () => {
    routeQuery = { autostart: '1' }
    let finishStart = () => {}
    vi.mocked(startReview).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishStart = () =>
            resolve({
              status: 'started',
              // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
              session: { id: 'sess-review' } as any,
            })
        }),
    )
    const wrapper = mountPage()
    await vi.waitFor(() => expect(startReview).toHaveBeenCalledTimes(1))

    await wrapper.get('[data-testid="start-review-button"]').trigger('click')
    expect(startReview).toHaveBeenCalledTimes(1)

    finishStart()
    await flushPromises()
  })
})

describe('Review page — live countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks the header timer down from 5:00', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const header = () => wrapper.find('[data-testid="review-header-stub"]')
    expect(header().attributes('data-time-str')).toBe('5:00')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(header().attributes('data-time-str')).toBe('4:00')
  })

  it('enters the urgent state near expiry', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const header = () => wrapper.find('[data-testid="review-header-stub"]')
    expect(header().attributes('data-time-urgent')).toBe('false')

    await vi.advanceTimersByTimeAsync(4 * 60_000 + 40_000)
    expect(header().attributes('data-time-urgent')).toBe('true')
  })
})

describe('Review page — queue → self-grade flow (primary)', () => {
  it('calls startReview and enters the self-grade flow when start is emitted', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    await flushPromises()

    expect(startReview).toHaveBeenCalledWith('enr-1')
    expect(wrapper.find('[data-testid="self-grade-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(false)
  })

  it('hides the queue entry once the self-grade flow starts', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="review-queue-entry-stub"]').exists()).toBe(false)
  })

  it('reveals and grades each card, advancing through the queue to the completion breakdown', async () => {
    stubQueue(2, 2)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    await flushPromises()

    // First card: reveal then rate "good" in-flow.
    expect(wrapper.find('[data-testid="self-grade-card"]').exists()).toBe(true)
    await wrapper.find('[data-testid="reveal-button"]').trigger('click')
    await wrapper.find('[data-testid="grade-good"]').trigger('click')
    await flushPromises()

    expect(gradeReviewItem).toHaveBeenCalledWith('ri-0', 'good')

    // Second (last) card: reveal then rate "again"; the flow then shows the completion breakdown.
    expect(wrapper.find('[data-testid="self-grade-card"]').exists()).toBe(true)
    await wrapper.find('[data-testid="reveal-button"]').trigger('click')
    await wrapper.find('[data-testid="grade-again"]').trigger('click')
    await flushPromises()

    expect(gradeReviewItem).toHaveBeenCalledWith('ri-1', 'again')
    expect(wrapper.find('[data-testid="self-grade-completion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="self-grade-count-good"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="self-grade-count-again"]').text()).toContain('1')
  })

  it('returns to the queue from the self-grade completion screen', async () => {
    stubQueue(1, 1)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="reveal-button"]').trigger('click')
    await wrapper.find('[data-testid="grade-easy"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="self-grade-completion"]').exists()).toBe(true)
    await wrapper.find('[data-testid="self-grade-completion"] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="review-queue-entry-stub"]').exists()).toBe(true)
  })
})

// The quiz + confidence run loop stays reachable as a secondary in-flow rating mode. These tests
// opt into it via the review-mode-quiz toggle before starting the run loop.
async function startInQuizMode(wrapper: ReturnType<typeof mountPage>) {
  await wrapper.find('[data-testid="review-mode-quiz"]').trigger('click')
  await wrapper.find('[data-testid="start-review-button"]').trigger('click')
  await flushPromises()
}

describe('Review page — quiz mode toggle → loop transition', () => {
  it('calls startReview and loads session items when started in quiz mode', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    expect(startReview).toHaveBeenCalledWith('enr-1')
    expect(fetchSessionDetail).toHaveBeenCalledWith('sess-review')
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(true)
  })

  it('hides the queue entry once the quiz loop starts', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    expect(wrapper.find('[data-testid="review-queue-entry-stub"]').exists()).toBe(false)
  })
})

describe('Review page — quiz loop: advancing items', () => {
  it('completes the item and advances when advance is emitted', async () => {
    stubSessionDetail([quizItem(0), quizItem(1)])
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    expect(wrapper.find('[data-testid="quiz-card"]').text()).toContain('quiz 0')

    await wrapper.find('[data-testid="quiz-card"]').trigger('click')
    await flushPromises()

    expect(completeSessionItem).toHaveBeenCalledWith('sess-review', 0)
    expect(wrapper.find('[data-testid="quiz-card"]').text()).toContain('quiz 1')
  })

  it('ends the session and shows completion when the last item is advanced', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    await wrapper.find('[data-testid="quiz-card"]').trigger('click')
    await flushPromises()

    expect(endSession).toHaveBeenCalledWith('sess-review')
    expect(fetchSessionSummary).toHaveBeenCalledWith('sess-review')
    expect(wrapper.find('[data-testid="session-summary-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(false)
  })
})

describe('Review page — quiz completion: drill action', () => {
  it('re-enters the loop with existing items when drill starts a new session', async () => {
    vi.mocked(drillSession).mockResolvedValue({
      status: 'started',
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
      session: { id: 'sess-drill' } as any,
    })
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    await wrapper.find('[data-testid="quiz-card"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="session-summary-page"]').exists()).toBe(true)

    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    await flushPromises()

    expect(drillSession).toHaveBeenCalledWith('sess-review')
    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(true)
  })

  it('navigates to / when back is clicked', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await startInQuizMode(wrapper)

    await wrapper.find('[data-testid="quiz-card"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="summary-back-button"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})

describe('Review page — unified entry', () => {
  it('does not expose a separate self-grade entry affordance', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="start-self-grade-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="start-review-button"]').exists()).toBe(true)
  })

  it('defaults the in-flow rating mode to self-grade and offers a secondary quiz toggle', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="review-mode-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-mode-self-grade"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-mode-quiz"]').exists()).toBe(true)
  })

  it('presents the rating mode toggle as a secondary, optional selector — not a competing entry CTA', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const toggle = wrapper.find('[data-testid="review-mode-toggle"]')
    expect(toggle.exists()).toBe(true)
    // The design's single-entry model has no top-level "rating style" setting. The toggle must
    // read as an optional, in-flow selector subordinate to the single "Start review →" CTA — not
    // a co-equal preference row labeled like a settings choice.
    expect(toggle.attributes('aria-label')).toMatch(/optional/i)
    expect(toggle.text()).not.toContain('Rating style')
  })
})
