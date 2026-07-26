import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionDomainToggle from '~/components/SessionDomainToggle.vue'

describe('SessionDomainToggle', () => {
  it('exposes selection and emits one toggle activation', async () => {
    const wrapper = mount(SessionDomainToggle, {
      props: { name: 'IAM & Security', score: 45, selected: true },
    })
    const button = wrapper.get('button')

    expect(button.attributes('aria-pressed')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})
