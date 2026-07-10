import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfidenceRating from '~/components/ConfidenceRating.vue'

describe('ConfidenceRating', () => {
  it('renders a control for each of the five points', () => {
    const wrapper = mount(ConfidenceRating, { props: { modelValue: undefined } })

    expect(wrapper.find('[data-testid="confidence-rating"]').exists()).toBe(true)
    for (const n of [1, 2, 3, 4, 5]) {
      expect(wrapper.find(`[data-testid="confidence-option-${n}"]`).exists()).toBe(true)
    }
  })

  it('emits the chosen integer', async () => {
    const wrapper = mount(ConfidenceRating, { props: { modelValue: undefined } })

    await wrapper.find('[data-testid="confidence-option-4"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([4])
  })

  it('marks the selected point as pressed', () => {
    const wrapper = mount(ConfidenceRating, { props: { modelValue: 2 } })

    expect(wrapper.find('[data-testid="confidence-option-2"]').attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('interpolates a topic-specific prompt when a topic is provided', () => {
    const wrapper = mount(ConfidenceRating, { props: { modelValue: undefined, topic: 'IAM & SCPs' } })

    expect(wrapper.text()).toContain('How confident do you feel about')
    expect(wrapper.text()).toContain('IAM & SCPs')
  })

  it('falls back to the generic prompt when no topic is provided', () => {
    const wrapper = mount(ConfidenceRating, { props: { modelValue: undefined } })

    expect(wrapper.text()).toContain('How confident do you feel?')
  })
})
