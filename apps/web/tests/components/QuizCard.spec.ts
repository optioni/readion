import type { SessionItemResponse } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuizCard from '~/components/QuizCard.vue'
import { reportQuizQuestion, submitQuizAnswer } from '~/composables/sessionViewApi'

vi.mock('~/composables/sessionViewApi', () => ({
  submitQuizAnswer: vi.fn(),
  reportQuizQuestion: vi.fn(),
}))

const OPTIONS = [
  'IAM permissions boundaries',
  'Service Control Policies (SCPs)',
  'Session policies',
] as const

const quizContent = JSON.stringify({
  questionId: 'q-1',
  question: 'Which AWS Organizations feature enforces permission guardrails across an OU?',
  options: OPTIONS,
  format: 'multiple_choice',
})

function quizItem(content = quizContent): SessionItemResponse {
  return {
    index: 1,
    type: 'quiz',
    content,
    completed: false,
    sourceChunkIds: ['chunk-scp-001'],
    supportingSpans: [],
  }
}

const insufficientItem: SessionItemResponse = {
  index: 2,
  type: 'quiz',
  content: JSON.stringify({ insufficient: true, domain: 'Cost-Optimized Architectures' }),
  completed: false,
  sourceChunkIds: [],
  supportingSpans: [],
}

function mountCard(item: SessionItemResponse = quizItem()) {
  return mount(QuizCard, {
    props: { sessionId: 'sess-1', userCertificationId: 'uc-1', item },
  })
}

const optionByText = (wrapper: ReturnType<typeof mountCard>, text: string) =>
  wrapper.findAll('[data-testid="quiz-option"]').find((o) => o.text().includes(text))

beforeEach(() => {
  vi.mocked(submitQuizAnswer).mockResolvedValue({
    id: 'r-1',
    correct: true,
    answer: OPTIONS[1],
    confidence: 4,
    timeTakenMs: 1000,
    userCertificationId: 'uc-1',
  })
  vi.mocked(reportQuizQuestion).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('QuizCard rendering', () => {
  it('renders the question stem and one option per choice', () => {
    const wrapper = mountCard()

    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('enforces permission guardrails')
    expect(wrapper.findAll('[data-testid="quiz-option"]')).toHaveLength(3)
  })
})

describe('QuizCard submit gating', () => {
  it('disables submit until both an option and a confidence are chosen', async () => {
    const wrapper = mountCard()
    const submit = () => wrapper.find('[data-testid="quiz-submit-button"]')

    expect(submit().attributes('disabled')).toBeDefined()

    await optionByText(wrapper, 'Service Control Policies')?.trigger('click')
    expect(submit().attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="confidence-option-4"]').trigger('click')
    expect(submit().attributes('disabled')).toBeUndefined()
  })
})

describe('QuizCard submit', () => {
  it('submits the chosen option text as the answer', async () => {
    const wrapper = mountCard()

    await optionByText(wrapper, 'Service Control Policies')?.trigger('click')
    await wrapper.find('[data-testid="confidence-option-4"]').trigger('click')
    await wrapper.find('[data-testid="quiz-submit-button"]').trigger('click')
    await flushPromises()

    expect(submitQuizAnswer).toHaveBeenCalledWith('q-1', {
      userCertificationId: 'uc-1',
      answer: OPTIONS[1],
      confidence: 4,
      timeTakenMs: expect.any(Number),
    })
  })

  it('colours the chosen option correct when the answer was correct', async () => {
    const wrapper = mountCard()

    await optionByText(wrapper, 'Service Control Policies')?.trigger('click')
    await wrapper.find('[data-testid="confidence-option-4"]').trigger('click')
    await wrapper.find('[data-testid="quiz-submit-button"]').trigger('click')
    await flushPromises()

    expect(optionByText(wrapper, 'Service Control Policies')?.attributes('data-state')).toBe(
      'correct',
    )
  })

  it('colours the chosen option incorrect when the answer was wrong', async () => {
    vi.mocked(submitQuizAnswer).mockResolvedValue({
      id: 'r-1',
      correct: false,
      answer: OPTIONS[0],
      confidence: 2,
      timeTakenMs: 1000,
      userCertificationId: 'uc-1',
    })
    const wrapper = mountCard()

    await optionByText(wrapper, 'IAM permissions boundaries')?.trigger('click')
    await wrapper.find('[data-testid="confidence-option-2"]').trigger('click')
    await wrapper.find('[data-testid="quiz-submit-button"]').trigger('click')
    await flushPromises()

    expect(optionByText(wrapper, 'IAM permissions boundaries')?.attributes('data-state')).toBe(
      'incorrect',
    )
    expect(optionByText(wrapper, 'Service Control Policies')?.attributes('data-state')).toBe('dim')
  })
})

describe('QuizCard continue', () => {
  it('emits advance with the item index after submitting', async () => {
    const wrapper = mountCard()

    await optionByText(wrapper, 'Service Control Policies')?.trigger('click')
    await wrapper.find('[data-testid="confidence-option-4"]').trigger('click')
    await wrapper.find('[data-testid="quiz-submit-button"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="quiz-continue-button"]').trigger('click')

    expect(wrapper.emitted('advance')?.at(-1)).toEqual([1])
  })
})

describe('QuizCard report', () => {
  it('reports the question and confirms after a 204', async () => {
    const wrapper = mountCard()

    await wrapper.find('[data-testid="quiz-report-button"]').trigger('click')
    await flushPromises()

    expect(reportQuizQuestion).toHaveBeenCalledTimes(1)
    const [questionId, body] = vi.mocked(reportQuizQuestion).mock.calls[0] as [
      string,
      { userCertificationId: string; reason: string },
    ]
    expect(questionId).toBe('q-1')
    expect(body.userCertificationId).toBe('uc-1')
    expect(body.reason.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Report received')
  })
})

describe('QuizCard insufficient material', () => {
  it('renders a graceful unavailable card and never submits', async () => {
    const wrapper = mountCard(insufficientItem)

    expect(wrapper.find('[data-testid="quiz-card"]').exists()).toBe(true)
    expect(wrapper.text()).toMatch(/unavailable/i)
    expect(wrapper.find('[data-testid="quiz-submit-button"]').exists()).toBe(false)

    await wrapper.find('[data-testid="advance-item-button"]').trigger('click')
    expect(wrapper.emitted('advance')?.at(-1)).toEqual([2])
    expect(submitQuizAnswer).not.toHaveBeenCalled()
  })
})
