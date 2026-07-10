import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MinimalLayout from '~/layouts/minimal.vue'

function mountLayout(slot: string) {
  return mount(MinimalLayout, {
    slots: { default: slot },
    global: {
      stubs: {
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('Minimal layout', () => {
  it('renders page content without the global app sidebar', () => {
    const wrapper = mountLayout('<section data-testid="page-content">Onboarding</section>')

    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="page-content"]').text()).toBe('Onboarding')
  })

  it('renders the accent brand mark icon beside the wordmark', () => {
    const wrapper = mountLayout('<section />')

    expect(wrapper.find('[data-testid="brand-mark"]').exists()).toBe(true)
  })
})
