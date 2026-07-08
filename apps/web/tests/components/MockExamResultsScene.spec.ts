import type { MockExamQuestionResponse, MockExamResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockExamResultsScene from '~/components/MockExamResultsScene.vue'
import { drillMockExam, fetchMockExamSummary } from '~/composables/mockExamApi'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerDetail } from '~~/src/api/user-certifications/user-certifications'

vi.mock('~/composables/mockExamApi', () => ({
  fetchMockExamSummary: vi.fn(),
  drillMockExam: vi.fn(),
}))

vi.mock('~~/src/api/user-certifications/user-certifications')
vi.mock('~~/src/api/certifications/certifications')

vi.stubGlobal('definePageMeta', vi.fn())
const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

const DOMAIN_BREAKDOWN = {
  'Resilient Architectures': { correct: 14, total: 18, accuracy: 0.78 },
  'Secure Architectures': { correct: 11, total: 16, accuracy: 0.69 },
  'High-Performing Architectures': { correct: 12, total: 16, accuracy: 0.75 },
  'Cost-Optimized Architectures': { correct: 9, total: 15, accuracy: 0.6 },
}

function buildQuestions(): MockExamQuestionResponse[] {
  const questions: MockExamQuestionResponse[] = []
  for (let i = 0; i < 65; i += 1) {
    const isUnanswered = i >= 61
    const isWrong = i === 0
    questions.push({
      id: `q-${i}`,
      question: `Question ${i}`,
      options: ['a', 'b'],
      domain: 'Resilient Architectures',
      userAnswer: isUnanswered ? null : isWrong ? 'wrong' : 'a',
    })
  }
  return questions
}

function buildExam(overrides: Partial<MockExamResponse> = {}): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'submitted',
    generation: 'ready',
    startedAt: '2026-06-29T10:00:00.000Z',
    deadline: '2026-06-29T11:47:23.000Z',
    remainingSeconds: 0,
    score: 0.73,
    passed: true,
    domainBreakdown: DOMAIN_BREAKDOWN,
    questions: buildQuestions(),
    ...overrides,
  }
}

const enrollmentEnvelope = (certificationId: string) => ({
  data: {
    data: {
      id: 'enr-1',
      certificationId,
      status: 'active',
      enrolledAt: '2026-06-01T00:00:00Z',
      sessionDefaults: {},
      readinessScore: 72,
    },
    relationships: { weakAreas: { href: '/x', data: [] } },
  },
  status: 200,
  headers: new Headers(),
})

const certificationEnvelope = () => ({
  data: {
    data: {
      id: 'cert-1',
      name: 'AWS Solutions Architect',
      provider: 'AWS',
      code: 'SAA-C03',
      domains: [{ name: 'Resilient Architectures', weight: 25 }],
      questionCount: 65,
      passingScore: 72,
      timeLimitMinutes: 130,
      state: 'ready',
    },
    relationships: {},
  },
  status: 200,
  headers: new Headers(),
})

function stubCertification() {
  vi.mocked(userCertificationsControllerDetail).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    enrollmentEnvelope('cert-1') as any,
  )
  vi.mocked(certificationsControllerDetail).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    certificationEnvelope() as any,
  )
}

function summaryDto(overrides: Record<string, unknown> = {}) {
  return {
    questionsAnswered: 65,
    accuracy: 0.73,
    domains: [
      { domain: 'Resilient Architectures', accuracy: 0.78 },
      { domain: 'Cost-Optimized Architectures', accuracy: 0.6 },
    ],
    weakAreaDeltas: [
      { domain: 'Resilient Architectures', delta: 8 },
      { domain: 'Cost-Optimized Architectures', delta: -3 },
    ],
    readiness: { before: 70, after: 74, delta: 4 },
    strongestQuestion: { responseId: 'resp-strong', question: 'Strongest?' },
    weakestQuestion: { responseId: 'resp-weak', question: 'Weakest?' },
    nextFocus: { domain: 'Cost-Optimized Architectures' },
    ...overrides,
  }
}

function stubSummary(overrides: Record<string, unknown> = {}) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchMockExamSummary).mockResolvedValue(summaryDto(overrides) as any)
}

function mountScene(exam: MockExamResponse = buildExam()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(MockExamResultsScene, {
    props: { exam, examId: exam.id },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubSummary()
  stubCertification()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MockExamResultsScene score hero', () => {
  it('renders the results scene root', () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-testid="exam-results-scene"]').exists()).toBe(true)
  })

  it('shows the score as a percentage with a PASS badge when passed is true', () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('73')
    expect(wrapper.find('[data-testid="exam-pass-badge"]').text()).toMatch(/pass/i)
  })

  it('shows a FAIL badge when passed is false', () => {
    const wrapper = mountScene(buildExam({ score: 0.58, passed: false }))
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('58')
    expect(wrapper.find('[data-testid="exam-pass-badge"]').text()).toMatch(/fail/i)
  })

  it('omits the badge entirely when passed is null (diagnostic-type)', () => {
    const wrapper = mountScene(buildExam({ passed: null, score: 0.66 }))
    expect(wrapper.find('[data-testid="exam-pass-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('66')
  })

  it('renders the score as round(score x 100)% for a fractional score', () => {
    const wrapper = mountScene(buildExam({ score: 0.7 }))
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('70%')
  })

  it('rounds a fractional score using standard rounding (0.735 -> 74%)', () => {
    const wrapper = mountScene(buildExam({ score: 0.735 }))
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('74%')
  })

  it('renders 100% for a perfect score', () => {
    const wrapper = mountScene(buildExam({ score: 1 }))
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('100%')
  })

  it('renders 0% for a zero score', () => {
    const wrapper = mountScene(buildExam({ score: 0 }))
    expect(wrapper.find('[data-testid="exam-score-value"]').text()).toContain('0%')
  })

  it('renders the passing-score reference derived from the certification', async () => {
    const wrapper = mountScene()
    await flushPromises()
    expect(wrapper.find('[data-testid="exam-passing-score"]').text()).toMatch(
      /passing score: 72%/i,
    )
  })

  it('omits the passing-score line when the certification is unavailable', async () => {
    vi.mocked(userCertificationsControllerDetail).mockRejectedValue(new Error('boom'))
    const wrapper = mountScene()
    await flushPromises()
    expect(wrapper.find('[data-testid="exam-passing-score"]').exists()).toBe(false)
  })

  it('renders correct/incorrect/unanswered counts derived from the attempt', async () => {
    const wrapper = mountScene()
    await flushPromises()
    const text = wrapper.find('[data-testid="exam-counts"]').text()
    expect(text).toMatch(/46 correct/i)
    expect(text).toMatch(/15 incorrect/i)
    expect(text).toMatch(/4 unanswered/i)
  })

  it('emits review when the review-all-answers button is clicked', async () => {
    const wrapper = mountScene()
    await wrapper.find('[data-testid="exam-review-button"]').trigger('click')
    expect(wrapper.emitted('review')).toHaveLength(1)
  })

  it('adds auto-submitted framing when the attempt expired', () => {
    const wrapper = mountScene(buildExam({ status: 'expired' }))
    expect(wrapper.find('[data-testid="exam-autosubmit-note"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="exam-autosubmit-note"]').text().toLowerCase()).toContain(
      'auto',
    )
    // Review remains available on expired attempts.
    expect(wrapper.find('[data-testid="exam-review-button"]').exists()).toBe(true)
  })

  it('does not show the auto-submitted note for a manual submission', () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-testid="exam-autosubmit-note"]').exists()).toBe(false)
  })
})

describe('MockExamResultsScene domain breakdown', () => {
  it('renders one row per domain', () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-testid="exam-domain-breakdown"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="exam-domain-row"]')).toHaveLength(4)
  })
})

describe('MockExamResultsScene reused summary body', () => {
  it('fetches the summary and renders the reused SessionSummaryBody', async () => {
    const wrapper = mountScene()
    await flushPromises()

    expect(fetchMockExamSummary).toHaveBeenCalledWith('exam-1')
    expect(wrapper.find('[data-testid="summary-readiness"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-readiness"]').text()).toContain('74')
    expect(wrapper.find('[data-testid="summary-domains"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-strongest"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-weakest"]').exists()).toBe(true)
  })

  it('suppresses the body ask-agent affordance in the agent-free exam context', async () => {
    const wrapper = mountScene()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="ask-agent-button"]')).toHaveLength(0)
  })

  it('renders exactly one back-to-dashboard control owned by the body', async () => {
    const wrapper = mountScene()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="summary-back-button"]')).toHaveLength(1)
  })

  it('derives the time label from the exam start and deadline window', async () => {
    const wrapper = mountScene()
    await flushPromises()
    expect(wrapper.text()).toContain('107m 23s')
  })
})

describe('MockExamResultsScene drill action', () => {
  it('navigates to the drill study session when a drill starts', async () => {
    vi.mocked(drillMockExam).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
      { status: 'started', session: { id: 'drill-1' } } as any,
    )
    const wrapper = mountScene()
    await flushPromises()

    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    await flushPromises()

    expect(drillMockExam).toHaveBeenCalledWith('exam-1')
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/drill-1')
  })

  it('shows the drill empty surface without navigating when there are no misses', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    vi.mocked(drillMockExam).mockResolvedValue({ status: 'no_misses' } as any)
    const wrapper = mountScene()
    await flushPromises()

    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="drill-empty"]').exists()).toBe(true)
  })
})

describe('MockExamResultsScene back action', () => {
  it('navigates to the dashboard on back', async () => {
    const wrapper = mountScene()
    await flushPromises()

    await wrapper.find('[data-testid="summary-back-button"]').trigger('click')
    await flushPromises()

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
