import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FormActions from '~/components/FormActions.vue'

describe('FormActions', () => {
  it('renders slotted content inside a trailing-edge flex row', () => {
    const wrapper = mount(FormActions, {
      slots: { default: '<button data-testid="action">Save</button>' },
    })

    const row = wrapper.find('div')
    expect(row.classes()).toContain('flex')
    expect(row.classes()).toContain('justify-end')
    expect(row.find('[data-testid="action"]').exists()).toBe(true)
  })
})
