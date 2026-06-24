import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppNavBar from '~/components/AppNavBar.vue'
import DefaultLayout from '~/layouts/default.vue'

vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

describe('Default layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the app banner and wraps page content in a centered max-width container', () => {
    const wrapper = mount(DefaultLayout, {
      slots: {
        default: '<section data-testid="page-content">Session content</section>',
      },
      global: {
        plugins: [createPinia()],
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
