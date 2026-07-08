import type { MockExamResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCertDetail } from '~/composables/useCertDetail'
import { useMockExamAttempt } from '~/composables/useMockExamAttempt'
import MockExamPage from '~/pages/mock-exams/[id]/index.vue'

vi.mock('~/composables/useMockExamAttempt', () => ({ useMockExamAttempt: vi.fn() }))
vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))

vi.stubGlobal('useRoute', () => ({ params: { id: 'exam-1' } }))
vi.stubGlobal('definePageMeta', vi.fn())
const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

function makeExam(overrides: Partial<MockExamResponse> = {}): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'in_progress',
    generation: 'ready',
    startedAt: '2026-06-29T00:00:00.000Z',
    deadline: '2026-06-29T01:30:00.000Z',
    remainingSeconds: 5400,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions: [
      {
        id: 'q-0',
        question: 'What?',
        options: ['a', 'b'],
        domain: 'Compute',
        userAnswer: null,
      },
    ],
    ...overrides,
  }
}

function stubAttempt(
  exam: MockExamResponse | null,
  state: { isLoading?: boolean; isError?: boolean } = {},
) {
  const examRef = ref<MockExamResponse | null>(exam)
  vi.mocked(useMockExamAttempt).mockReturnValue({
    // biome-ignore lint/suspicious/noExplicitAny: query handle unused by the page test
    query: {} as any,
    exam: computed(() => examRef.value),
    isLoading: computed(() => state.isLoading ?? false),
    isError: computed(() => state.isError ?? false),
  })
}

function stubCert() {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => 'Solutions Architect – Associate'),
    provider: computed(() => 'AWS'),
    code: computed(() => 'SAA-C03'),
    certificationId: computed(() => 'cert-1'),
    domains: computed(() => []),
    questionCount: computed(() => 65),
    passingScore: computed(() => null),
    isLoading: computed(() => false),
    isError: computed(() => false),
    notFound: computed(() => false),
  })
}

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(MockExamPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        MockExamPreparingScene: {
          props: ['exam', 'certCode', 'certName', 'targetCount'],
          template:
            '<div data-testid="preparing-stub" :data-target="targetCount" :data-code="certCode" />',
        },
        MockExamActiveScene: {
          props: ['exam', 'examId', 'certCode', 'certName'],
          template:
            '<div data-testid="active-stub" :data-exam-id="examId" :data-code="certCode" />',
        },
        MockExamResultsScene: {
          props: ['exam', 'examId'],
          template:
            '<div data-testid="results-stub" :data-exam-id="examId" @click="$emit(\'review\')" />',
        },
        MockExamReviewScene: {
          props: ['exam', 'certCode', 'certName'],
          template:
            '<div data-testid="review-stub" :data-code="certCode" @click="$emit(\'back\')" />',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubCert()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Mock exam page shell', () => {
  it('resolves the attempt for the route id and renders the page root', async () => {
    stubAttempt(makeExam())
    const wrapper = mountPage()
    await flushPromises()

    expect(useMockExamAttempt).toHaveBeenCalledWith('exam-1')
    expect(wrapper.find('[data-testid="mock-exam-page"]').exists()).toBe(true)
  })

  it('renders a loading state before the attempt resolves', () => {
    stubAttempt(null, { isLoading: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="mock-exam-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mock-exam-page"]').exists()).toBe(false)
  })

  it('renders an error state when the attempt fails to load', () => {
    stubAttempt(null, { isError: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="mock-exam-error"]').exists()).toBe(true)
  })
})

describe('Mock exam page scene selection', () => {
  it('renders the preparing scene while generation is preparing', async () => {
    stubAttempt(makeExam({ generation: 'preparing' }))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="preparing-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="active-stub"]').exists()).toBe(false)
  })

  it('passes the cert questionCount as the preparing targetCount and the cert code', async () => {
    stubAttempt(makeExam({ generation: 'preparing' }))
    const wrapper = mountPage()
    await flushPromises()

    const stub = wrapper.find('[data-testid="preparing-stub"]')
    expect(stub.attributes('data-target')).toBe('65')
    expect(stub.attributes('data-code')).toBe('SAA-C03')
  })

  it('renders the active scene when ready and in progress', async () => {
    stubAttempt(makeExam({ generation: 'ready', status: 'in_progress' }))
    const wrapper = mountPage()
    await flushPromises()

    const stub = wrapper.find('[data-testid="active-stub"]')
    expect(stub.exists()).toBe(true)
    expect(stub.attributes('data-exam-id')).toBe('exam-1')
  })

  it('renders the results scene when the attempt is submitted', async () => {
    stubAttempt(makeExam({ generation: 'ready', status: 'submitted' }))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(true)
  })

  it('renders the results scene when the attempt is expired', async () => {
    stubAttempt(makeExam({ generation: 'ready', status: 'expired' }))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(true)
  })
})

describe('Mock exam page review sub-mode', () => {
  it('toggles to review on the results review event and back again', async () => {
    stubAttempt(makeExam({ generation: 'ready', status: 'submitted' }))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="results-stub"]').trigger('click')
    expect(wrapper.find('[data-testid="review-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)

    await wrapper.find('[data-testid="review-stub"]').trigger('click')
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-stub"]').exists()).toBe(false)
  })

  it('never renders review for a non-terminal (active) attempt', async () => {
    stubAttempt(makeExam({ generation: 'ready', status: 'in_progress' }))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="review-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="active-stub"]').exists()).toBe(true)
  })
})
