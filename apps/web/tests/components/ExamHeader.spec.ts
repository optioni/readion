import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExamHeader from '~/components/ExamHeader.vue'

describe('ExamHeader', () => {
  it('renders the cert code chip', () => {
    const wrapper = mount(ExamHeader, {
      props: {
        certCode: 'SAA-C03',
        certName: 'AWS Solutions Architect',
        mode: 'active',
        totalQuestions: 65,
      },
    })

    const chip = wrapper.find('[data-testid="exam-cert-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('SAA-C03')
  })

  it('shows the mode label for each mode', () => {
    const preparing = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'preparing', totalQuestions: 65, paused: true },
    })
    expect(preparing.find('[data-testid="exam-header"]').text()).toContain('Preparing exam…')

    const active = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', totalQuestions: 65 },
    })
    expect(active.find('[data-testid="exam-header"]').text()).toContain('Mock Exam')

    const review = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'review', totalQuestions: 65 },
    })
    expect(review.find('[data-testid="exam-header"]').text()).toContain('Review mode')
  })

  it('renders a 1-based question counter over the zero-based index', () => {
    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', currentIndex: 0, totalQuestions: 65 },
    })

    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(/Question 1 of 65/)
  })

  it('omits the question counter when no current index is supplied', () => {
    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'preparing', totalQuestions: 65, paused: true },
    })

    expect(wrapper.find('[data-testid="exam-question-counter"]').exists()).toBe(false)
  })

  it('shows the paused timer placeholder while preparing', () => {
    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'preparing', totalQuestions: 65, paused: true },
    })

    expect(wrapper.find('[data-testid="exam-timer-paused"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="exam-timer"]').exists()).toBe(false)
  })

  it('shows the running countdown when not paused', () => {
    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', totalQuestions: 65, timer: '01:47:23' },
    })

    const timer = wrapper.find('[data-testid="exam-timer"]')
    expect(timer.exists()).toBe(true)
    expect(timer.text()).toBe('01:47:23')
    expect(wrapper.find('[data-testid="exam-timer-paused"]').exists()).toBe(false)
  })

  it('applies an urgent treatment to the timer near zero', () => {
    const calm = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', totalQuestions: 65, timer: '01:00:00' },
    })
    expect(calm.find('[data-testid="exam-timer"]').attributes('data-urgent')).toBe('false')

    const urgent = mount(ExamHeader, {
      props: {
        certCode: 'SAA-C03',
        mode: 'active',
        totalQuestions: 65,
        timer: '00:00:09',
        urgent: true,
      },
    })
    expect(urgent.find('[data-testid="exam-timer"]').attributes('data-urgent')).toBe('true')
  })

  it('exposes a session-local flag toggle only during the active exam, persisting nothing', async () => {
    const review = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'review', totalQuestions: 65 },
    })
    expect(review.find('[data-testid="exam-flag-toggle"]').exists()).toBe(false)

    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', currentIndex: 0, totalQuestions: 65 },
    })
    const toggle = wrapper.find('[data-testid="exam-flag-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('data-flagged')).toBe('false')

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="exam-flag-toggle"]').attributes('data-flagged')).toBe('true')

    // Session-local: a flag never emits a persistence event (no custom flag/save emit).
    expect(wrapper.emitted('flag')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
