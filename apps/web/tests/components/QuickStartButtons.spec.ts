import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuickStartButtons from '~/components/QuickStartButtons.vue'

const mountButtons = (variant: 'hero' | 'standard' = 'standard') =>
  mount(QuickStartButtons, {
    props: {
      variant,
      isStartingSession: false,
      isStartingMockExam: false,
    },
  })

describe('QuickStartButtons — sentence-case copy', () => {
  it('reads "Mock exam" in sentence case, not "Mock Exam"', () => {
    const wrapper = mountButtons()
    expect(wrapper.find('[data-testid="mock-exam-btn"]').text()).toBe('Mock exam')
  })

  it.each([
    ['mock-exam-btn', { isStartingMockExam: true }],
    ['start-session-btn', { isStartingSession: true }],
  ])('identifies only the initiating %s action as busy', async (testId, pendingProps) => {
    const wrapper = mountButtons()
    await wrapper.setProps(pendingProps)

    const busyAction = wrapper.get(`[data-testid="${testId}"]`)
    expect(busyAction.attributes('aria-busy')).toBe('true')
    expect(busyAction.text()).toContain('Starting…')
    expect(busyAction.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)

    const otherTestId = testId === 'mock-exam-btn' ? 'start-session-btn' : 'mock-exam-btn'
    expect(wrapper.get(`[data-testid="${otherTestId}"]`).attributes('aria-busy')).toBeUndefined()
  })

  it('renders action-local failure feedback while returning controls to a retryable state', () => {
    const wrapper = mount(QuickStartButtons, {
      props: {
        variant: 'standard',
        isStartingSession: false,
        isStartingMockExam: false,
        sessionError: "Couldn't start the session. Try again.",
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain("Couldn't start the session")
    expect(wrapper.get('[data-testid="start-session-btn"]').attributes('disabled')).toBeUndefined()
  })
})
