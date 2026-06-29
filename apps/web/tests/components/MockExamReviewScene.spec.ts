import type { MockExamQuestionResponse, MockExamResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MockExamReviewScene from '~/components/MockExamReviewScene.vue'

const Q0_OPTIONS = [
  'Enable cross-zone load balancing',
  'Convert the instance to a Multi-AZ deployment',
  'Add a cross-region read replica',
  'Increase the instance size',
]

function terminalQuestion(
  index: number,
  userAnswer: string | null,
): MockExamQuestionResponse {
  if (index === 0) {
    return {
      id: 'q-0',
      question: 'Which change adds Availability Zone redundancy to a single-AZ RDS database?',
      options: Q0_OPTIONS,
      domain: 'Resilient Architectures',
      userAnswer,
      correctAnswer: Q0_OPTIONS[1],
      explanation:
        'Multi-AZ creates a synchronous standby in a second Availability Zone and fails over automatically.',
      citations: [
        {
          chunkId: 'chunk-rds-multiaz-001',
          text: 'Amazon RDS Multi-AZ deployments provide enhanced availability via a synchronous standby.',
        },
      ],
    }
  }
  const options = [`Option A for Q${index + 1}`, `Option B for Q${index + 1}`]
  return {
    id: `q-${index}`,
    question: `Sample mock-exam question ${index + 1}?`,
    options,
    domain: 'Secure Architectures',
    userAnswer,
    correctAnswer: options[1],
    explanation: `Explanation for question ${index + 1}: option B is correct.`,
    citations: [{ chunkId: `chunk-${index}`, text: `Source span for question ${index + 1}.` }],
  }
}

function buildExam(questions: MockExamQuestionResponse[]): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'submitted',
    generation: 'ready',
    startedAt: '2026-06-29T10:00:00.000Z',
    deadline: '2026-06-29T11:47:23.000Z',
    remainingSeconds: 0,
    score: 73,
    passed: true,
    domainBreakdown: {},
    questions,
  }
}

// Q0 answered incorrectly, Q1 answered correctly, Q2 skipped.
function terminalExam(): MockExamResponse {
  return buildExam([
    terminalQuestion(0, Q0_OPTIONS[2]),
    terminalQuestion(1, 'Option B for Q2'),
    terminalQuestion(2, null),
  ])
}

function mountScene(exam: MockExamResponse) {
  return mount(MockExamReviewScene, {
    props: { exam, certCode: 'SAA-C03', certName: 'AWS Solutions Architect' },
  })
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

describe('MockExamReviewScene', () => {
  it('renders the review scene root', () => {
    const wrapper = mountScene(terminalExam())
    expect(wrapper.find('[data-testid="exam-review-scene"]').exists()).toBe(true)
  })

  it('reveals the correct, incorrect, and dimmed option states for the current question', () => {
    const wrapper = mountScene(terminalExam())

    expect(optionByText(wrapper, /multi-az/i).attributes('data-state')).toBe('correct')
    expect(optionByText(wrapper, /cross-region read replica/i).attributes('data-state')).toBe(
      'incorrect',
    )
    expect(optionByText(wrapper, /cross-zone load balancing/i).attributes('data-state')).toBe('dim')
    expect(optionByText(wrapper, /increase the instance size/i).attributes('data-state')).toBe(
      'dim',
    )
  })

  it('shows the explanation and at least one citation chip', () => {
    const wrapper = mountScene(terminalExam())

    expect(wrapper.find('[data-testid="exam-explanation"]').text()).toContain(
      'synchronous standby',
    )
    expect(wrapper.findAll('[data-testid="citation-chip"]').length).toBeGreaterThanOrEqual(1)
  })

  it('recolours the nav squares by per-question outcome and surfaces the counts', () => {
    const wrapper = mountScene(terminalExam())

    const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
    expect(squares.map((s) => s.attributes('data-state'))).toEqual([
      'incorrect',
      'correct',
      'skipped',
    ])

    const counts = wrapper.find('[data-testid="exam-review-counts"]').text()
    expect(counts).toMatch(/1 correct/)
    expect(counts).toMatch(/1 incorrect/)
    expect(counts).toMatch(/1 skipped/)
  })

  it('jumps to a question when its nav square is clicked', async () => {
    const wrapper = mountScene(terminalExam())

    await wrapper.findAll('[data-testid="exam-nav-square"]')[1]!.trigger('click')

    expect(wrapper.find('[data-testid="exam-question-stem"]').text()).toContain(
      'Sample mock-exam question 2',
    )
    expect(wrapper.find('[data-testid="exam-explanation"]').text()).toContain(
      'option B is correct',
    )
  })

  it('steps forward and back through questions with Next and Previous', async () => {
    const wrapper = mountScene(terminalExam())

    await wrapper.find('[data-testid="exam-next-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-stem"]').text()).toContain(
      'Sample mock-exam question 2',
    )

    await wrapper.find('[data-testid="exam-prev-button"]').trigger('click')
    expect(wrapper.find('[data-testid="exam-question-stem"]').text()).toContain(
      'Availability Zone redundancy',
    )
  })

  it('emits back when the back-to-results control is clicked', async () => {
    const wrapper = mountScene(terminalExam())

    await wrapper.find('[data-testid="exam-review-back-button"]').trigger('click')

    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
