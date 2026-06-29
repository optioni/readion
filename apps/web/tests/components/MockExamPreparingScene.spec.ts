import type { MockExamResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MockExamPreparingScene from '~/components/MockExamPreparingScene.vue'

function exam(questionCount: number): MockExamResponse {
  return {
    id: 'exam-1',
    userCertificationId: 'enr-1',
    type: 'mock',
    status: 'in_progress',
    generation: 'preparing',
    startedAt: null,
    deadline: null,
    remainingSeconds: null,
    score: null,
    passed: null,
    domainBreakdown: {},
    questions: Array.from({ length: questionCount }, (_unused, index) => ({
      id: `q-${index}`,
      question: `Q${index}`,
      options: ['a', 'b', 'c', 'd'],
      domain: 'Domain',
      userAnswer: null,
    })),
  }
}

function mountScene(targetCount?: number) {
  return mount(MockExamPreparingScene, {
    props: {
      exam: exam(20),
      certCode: 'SAA-C03',
      certName: 'AWS Solutions Architect',
      ...(targetCount === undefined ? {} : { targetCount }),
    },
  })
}

describe('MockExamPreparingScene', () => {
  it('renders the preparing scene root', () => {
    const wrapper = mountScene(65)
    expect(wrapper.find('[data-testid="exam-preparing-scene"]').exists()).toBe(true)
  })

  it('reflects the streamed-in count against the target as "N / total ready"', () => {
    const wrapper = mountScene(65)
    expect(wrapper.find('[data-testid="exam-prepare-progress"]').text()).toMatch(/20 \/ 65 ready/)
  })

  it('shows the paused timer surface while the deadline is null', () => {
    const wrapper = mountScene(65)
    expect(wrapper.find('[data-testid="exam-timer-paused"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="exam-timer"]').exists()).toBe(false)
  })

  it('passes the cert code through to the header chip', () => {
    const wrapper = mountScene(65)
    expect(wrapper.find('[data-testid="exam-cert-chip"]').text()).toContain('SAA-C03')
  })

  it('falls back to the streamed length when no target is supplied', () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-testid="exam-prepare-progress"]').text()).toMatch(/20 \/ 20 ready/)
  })
})
