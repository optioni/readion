import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import AppSidebar from '~/components/AppSidebar.vue'
import { useEnrollments } from '~/composables/useEnrollments'
import DefaultLayout from '~/layouts/default.vue'

vi.mock('~/composables/useEnrollments', () => ({ useEnrollments: vi.fn() }))

vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
vi.stubGlobal('useRoute', () => ({ path: '/' }))
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.restoreAllMocks()
  vi.mocked(useEnrollments).mockReturnValue({
    cards: computed(() => []),
    isLoading: computed(() => false),
    isError: computed(() => false),
  })
})

function mountLayout(slot: string) {
  return mount(DefaultLayout, {
    slots: { default: slot },
    global: {
      plugins: [pinia],
      components: { AppSidebar },
      stubs: {
        ColorModeToggle: { template: '<button type="button" />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('Default layout', () => {
  it('renders the persistent sidebar shell and wraps page content in the shell container', () => {
    const wrapper = mountLayout('<section data-testid="page-content">Session content</section>')

    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true)

    const container = wrapper.get('[data-testid="shell-container"]')
    expect(container.text()).toContain('Session content')
    expect(container.find('[data-testid="page-content"]').exists()).toBe(true)
  })

  it('lets in-content section chrome (e.g. the admin sub-nav) render alongside the sidebar', () => {
    const wrapper = mountLayout(
      '<section data-testid="admin-console"><nav data-testid="admin-sidebar" /></section>',
    )

    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true)
    const container = wrapper.get('[data-testid="shell-container"]')
    expect(container.find('[data-testid="admin-sidebar"]').exists()).toBe(true)
  })
})
