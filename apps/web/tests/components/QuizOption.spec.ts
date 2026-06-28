import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuizOption from '~/components/QuizOption.vue'

describe('QuizOption', () => {
  it('renders the letter and text', () => {
    const wrapper = mount(QuizOption, { props: { letter: 'B', text: 'Service Control Policies', state: 'rest' } })

    expect(wrapper.text()).toContain('B')
    expect(wrapper.text()).toContain('Service Control Policies')
  })

  it('reflects its state through data-state', () => {
    const wrapper = mount(QuizOption, { props: { letter: 'B', text: 'opt', state: 'correct' } })
    expect(wrapper.find('[data-testid="quiz-option"]').attributes('data-state')).toBe('correct')
  })

  it('emits select when clicked', async () => {
    const wrapper = mount(QuizOption, { props: { letter: 'A', text: 'opt', state: 'rest' } })

    await wrapper.find('[data-testid="quiz-option"]').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})
