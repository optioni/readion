import type { MockExamQuestionResponse, MockExamResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockExamActiveScene from '~/components/MockExamActiveScene.vue'
import { saveMockExamAnswer, submitMockExam } from '~/composables/mockExamApi'

vi.mock('~/composables/mockExamApi', () => ({
  saveMockExamAnswer: vi.fn(),
  submitMockExam: vi.fn(),
}))

const Q0_OPTIONS = [
  'Enable cross-zone load balancing',
  'Convert the instance to a Multi-AZ deployment',
  'Add a cross-region read replica',
  'Increase the instance size',
]

function question(index: number, userAnswer: string | null = null): MockExamQuestionResponse {
  if (index === 0) {
    return {
      id: 'q-0',
      question: 'Which change adds Availability Zone redundancy to a single-AZ RDS database?',
      options: Q0_OPTIONS,
      domain: 'Resilient Architectures',
      userAnswer,
    }
  }
  return {
    id: `q-${index}`,
    question: `Sample mock-exam question ${index + 1}?`,
    options: [`Option A for Q${index + 1}`, `Option B for Q${index + 1}`],
    domain: 'Secure Architectures',
    userAnswer,
  }
}

function buildExam(
  questions: MockExamQuestionResponse[],
  overrides: Partial<MockExamResponse> = {},
): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'in_progress',
    generation: 'ready',
    startedAt: new Date(Date.now() - 600_000).toISOString(),
    deadline: new Date(Date.now() + 6_443_000).toISOString(),
    remainingSeconds: 6443,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions,
    ...overrides,
  }
}

function mountScene(exam: MockExamResponse) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(MockExamActiveScene, {
    props: { exam, examId: exam.id, certCode: 'SAA-C03', certName: 'AWS Solutions Architect' },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

function examWith65() {
  return buildExam(Array.from({ length: 65 }, (_unused, index) => question(index)))
}

function optionByText(wrapper: ReturnType<typeof mountScene>, text: RegExp) {
  const option = wrapper
    .findAll('[data-testid="exam-option"]')
    .find((node) => text.test(node.text()))
  if (!option) {
    throw new Error(`option not found for ${text}`)
  }
  return option
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveMockExamAnswer).mockResolvedValue(examWith65())
  vi.mocked(submitMockExam).mockResolvedValue(
    buildExam(examWith65().questions, { status: 'submitted', score: 73, passed: true }),
  )
})

describe('MockExamActiveScene', () => {
  it('renders the active scene root', () => {
    const wrapper = mountScene(examWith65())
    expect(wrapper.find('[data-testid="exam-active-scene"]').exists()).toBe(true)
  })

  it('renders the current question domain, stem, and options', () => {
    const wrapper = mountScene(examWith65())
    expect(wrapper.find('[data-testid="exam-domain-tag"]').text()).toContain(
      'Resilient Architectures',
    )
    expect(wrapper.find('[data-testid="exam-question-stem"]').text()).toContain(
      'Availability Zone redundancy',
    )
    expect(wrapper.findAll('[data-testid="exam-option"]')).toHaveLength(4)
  })

  it('shows the 1-based question counter for a zero-based position', () => {
    const wrapper = mountScene(examWith65())
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+1\s+of\s+65/,
    )
  })

  it('persists the chosen answer at the zero-based index and marks it answered', async () => {
    const wrapper = mountScene(examWith65())

    const multiAz = optionByText(wrapper, /multi-az/i)
    await multiAz.trigger('click')
    await flushPromises()

    expect(saveMockExamAnswer).toHaveBeenCalledWith('exam-1', 0, {
      answer: 'Convert the instance to a Multi-AZ deployment',
    })
    expect(optionByText(wrapper, /multi-az/i).attributes('data-state')).toBe('selected')
    expect(wrapper.findAll('[data-testid="exam-nav-square"]')[0]!.attributes('data-state')).toBe(
      'answered',
    )
  })

  it('overwrites the same zero-based index when a different option is re-selected', async () => {
    const wrapper = mountScene(examWith65())

    await optionByText(wrapper, /multi-az/i).trigger('click')
    await flushPromises()
    await optionByText(wrapper, /cross-region read replica/i).trigger('click')
    await flushPromises()

    expect(saveMockExamAnswer).toHaveBeenNthCalledWith(2, 'exam-1', 0, {
      answer: 'Add a cross-region read replica',
    })
    expect(optionByText(wrapper, /cross-region read replica/i).attributes('data-state')).toBe(
      'selected',
    )
    expect(optionByText(wrapper, /multi-az/i).attributes('data-state')).toBe('rest')
  })

  it('never reveals correct/incorrect state during the active exam', async () => {
    const wrapper = mountScene(examWith65())
    await optionByText(wrapper, /multi-az/i).trigger('click')
    await flushPromises()

    for (const option of wrapper.findAll('[data-testid="exam-option"]')) {
      expect(['rest', 'selected']).toContain(option.attributes('data-state'))
    }
  })

  it('moves position with Next, Previous, and Skip', async () => {
    const wrapper = mountScene(examWith65())

    await wrapper.find('[data-testid="exam-next-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+2\s+of/,
    )

    await wrapper.find('[data-testid="exam-skip-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+3\s+of/,
    )

    await wrapper.find('[data-testid="exam-prev-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+2\s+of/,
    )
  })

  it('clamps Previous at the first question', async () => {
    const wrapper = mountScene(examWith65())
    await wrapper.find('[data-testid="exam-prev-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+1\s+of/,
    )
  })

  it('navigates to a question when its nav square is clicked', async () => {
    const wrapper = mountScene(examWith65())
    await wrapper.findAll('[data-testid="exam-nav-square"]')[3]!.trigger('click')
    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
      /Question\s+4\s+of/,
    )
  })

  describe('submit', () => {
    it('opens the unanswered confirmation when the nav submit button is clicked', async () => {
      const wrapper = mountScene(examWith65())

      expect(wrapper.find('[data-testid="exam-submit-confirm"]').exists()).toBe(false)
      await wrapper.find('[data-testid="exam-submit-button"]').trigger('click')

      const confirm = wrapper.find('[data-testid="exam-submit-confirm"]')
      expect(confirm.exists()).toBe(true)
      // No answers recorded yet: all 65 questions are unanswered and warned to score as incorrect.
      expect(confirm.text()).toMatch(/unanswered/i)
      expect(confirm.text()).toContain('65')
      expect(submitMockExam).not.toHaveBeenCalled()
    })

    it('reflects the live unanswered count after a question is answered', async () => {
      const wrapper = mountScene(examWith65())

      await optionByText(wrapper, /multi-az/i).trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="exam-submit-button"]').trigger('click')

      expect(wrapper.find('[data-testid="exam-submit-confirm"]').text()).toContain('64')
    })

    it('submits when the confirmation button is clicked', async () => {
      const wrapper = mountScene(examWith65())

      await wrapper.find('[data-testid="exam-submit-button"]').trigger('click')
      await wrapper.find('[data-testid="exam-submit-confirm-button"]').trigger('click')
      await flushPromises()

      expect(submitMockExam).toHaveBeenCalledWith('exam-1')
    })
  })

  describe('resume', () => {
    it('rehydrates answers and opens at the first unanswered question', () => {
      const questions = [
        question(0, Q0_OPTIONS[1]),
        question(1, 'Option B for Q2'),
        question(2, 'Option B for Q3'),
        question(3, 'Option B for Q4'),
        question(4, 'Option B for Q5'),
        question(5, null),
        question(6, null),
      ]
      const wrapper = mountScene(buildExam(questions))

      expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
        /Question\s+6\s+of\s+7/,
      )
      const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
      for (let index = 0; index < 5; index += 1) {
        expect(squares[index]!.attributes('data-state')).toBe('answered')
      }
    })

    it('opens at the first question when every question is answered', () => {
      const questions = [question(0, Q0_OPTIONS[1]), question(1, 'Option B for Q2')]
      const wrapper = mountScene(buildExam(questions))
      expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(
        /Question\s+1\s+of\s+2/,
      )
    })
  })

  describe('countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders a server-seeded HH:MM:SS timer that ticks down', async () => {
      const wrapper = mountScene(
        buildExam([question(0)], { deadline: null, remainingSeconds: 6443 }),
      )

      expect(wrapper.find('[data-testid="exam-timer"]').text()).toMatch(/\d\d:\d\d:\d\d/)
      expect(wrapper.find('[data-testid="exam-timer"]').text()).toContain('01:47:23')

      await vi.advanceTimersByTimeAsync(1000)
      expect(wrapper.find('[data-testid="exam-timer"]').text()).toContain('01:47:22')

      wrapper.unmount()
    })

    it('auto-submits without confirmation when the countdown reaches zero', async () => {
      const wrapper = mountScene(buildExam([question(0)], { deadline: null, remainingSeconds: 2 }))

      await vi.advanceTimersByTimeAsync(2000)
      await flushPromises()

      expect(submitMockExam).toHaveBeenCalledWith('exam-1')
      expect(wrapper.find('[data-testid="exam-submit-confirm"]').exists()).toBe(false)

      wrapper.unmount()
    })
  })
})

afterEach(() => {
  vi.clearAllMocks()
})
