import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppNavBar from '~/components/AppNavBar.vue'
import DefaultLayout from '~/layouts/default.vue'

describe('Default layout', () => {
  it('renders the app banner and wraps page content in a centered max-width container', () => {
    const wrapper = mount(DefaultLayout, {
      slots: {
        default: '<section data-testid="page-content">Session content</section>',
      },
      global: {
        components: {
          AppNavBar,
        },
        stubs: {
          ColorModeToggle: { template: '<button type="button" />' },
          NuxtLink: { template: '<a><slot /></a>' },
        },
      },
    })

    const banner = wrapper.get('header')
    expect(banner.text()).toContain('Readion')

    const container = wrapper.get('[data-testid="shell-container"]')
    expect(container.classes()).toEqual(expect.arrayContaining(['mx-auto', 'max-w-7xl']))
    expect(container.text()).toContain('Session content')
  })
})
