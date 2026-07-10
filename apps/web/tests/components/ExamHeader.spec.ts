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

    expect(wrapper.find('[data-testid="exam-question-counter"]').text()).toMatch(/Q 1 \/ 65/)
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

  it('exposes a flag toggle only during the active exam, reflecting the flagged prop', async () => {
    const review = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'review', totalQuestions: 65 },
    })
    expect(review.find('[data-testid="exam-flag-toggle"]').exists()).toBe(false)

    const wrapper = mount(ExamHeader, {
      props: {
        certCode: 'SAA-C03',
        mode: 'active',
        currentIndex: 0,
        totalQuestions: 65,
        flagged: false,
      },
    })
    const toggle = wrapper.find('[data-testid="exam-flag-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('data-flagged')).toBe('false')

    // The toggle is a per-question decision owned by the parent (keyed by the current question
    // index), not local state — clicking emits toggle-flag rather than flipping its own ref.
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-flag')).toHaveLength(1)
    expect(wrapper.find('[data-testid="exam-flag-toggle"]').attributes('data-flagged')).toBe(
      'false',
    )

    await wrapper.setProps({ flagged: true })
    expect(wrapper.find('[data-testid="exam-flag-toggle"]').attributes('data-flagged')).toBe('true')

    // Session-local: a flag never emits a persistence event.
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('renders the accent logo mark', () => {
    const wrapper = mount(ExamHeader, {
      props: { certCode: 'SAA-C03', mode: 'active', totalQuestions: 65 },
    })

    expect(wrapper.find('[data-testid="exam-logo-mark"]').exists()).toBe(true)
  })

  it('shows only the cert code, not the full cert name, in the active state', () => {
    const wrapper = mount(ExamHeader, {
      props: {
        certCode: 'SAA-C03',
        certName: 'AWS Solutions Architect',
        mode: 'active',
        totalQuestions: 65,
      },
    })

    expect(wrapper.text()).toContain('SAA-C03')
    expect(wrapper.text()).not.toContain('AWS Solutions Architect')
  })

  it('renders icons for the timer and the flag toggle', () => {
    const wrapper = mount(ExamHeader, {
      props: {
        certCode: 'SAA-C03',
        mode: 'active',
        currentIndex: 0,
        totalQuestions: 65,
        timer: '01:47:23',
        flagged: false,
      },
    })

    expect(wrapper.find('[data-testid="exam-timer-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="exam-flag-icon"]').exists()).toBe(true)
  })
})
