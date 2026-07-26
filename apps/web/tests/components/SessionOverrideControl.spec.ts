import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionOverrideControl from '~/components/SessionOverrideControl.vue'

describe('SessionOverrideControl', () => {
  it('exposes the selected option and emits the next selection', async () => {
    const wrapper = mount(SessionOverrideControl, {
      props: {
        label: 'Duration',
        testidPrefix: 'duration-option',
        options: [15, 30, 45],
        modelValue: 30,
        format: (value: string | number) => `${value}m`,
      },
    })

    expect(wrapper.get('[data-testid="duration-option-30"]').attributes('aria-pressed')).toBe(
      'true',
    )
    await wrapper.get('[data-testid="duration-option-45"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([45])
  })
})
