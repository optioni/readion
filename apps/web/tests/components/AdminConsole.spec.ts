import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminConsole from '~/components/admin/AdminConsole.vue'

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to" :data-testid="$attrs[`data-testid`]"><slot /></a>',
}

function mountConsole(path: string) {
  vi.stubGlobal('useRoute', () => ({ path }))
  return mount(AdminConsole, {
    slots: { default: '<div data-testid="section-content">Section</div>' },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('AdminConsole shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the console root, sidebar, and every nav affordance', () => {
    const wrapper = mountConsole('/admin/certifications')

    expect(wrapper.find('[data-testid="admin-console"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-sidebar"]').exists()).toBe(true)
    for (const id of [
      'admin-nav-certifications',
      'admin-nav-review-queue',
      'admin-nav-sources',
      'admin-nav-users',
      'admin-nav-audit-log',
      'admin-nav-settings',
    ]) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true)
    }
  })

  it('renders the default slot for section content', () => {
    const wrapper = mountConsole('/admin/certifications')
    expect(wrapper.find('[data-testid="section-content"]').exists()).toBe(true)
  })

  it('links the Settings affordance out to the existing /settings page', () => {
    const wrapper = mountConsole('/admin/users')
    const settings = wrapper.find('[data-testid="admin-nav-settings"]')
    expect(settings.attributes('href')).toBe('/settings')
  })

  it('marks the active section based on the current route path', () => {
    const wrapper = mountConsole('/admin/users')
    expect(wrapper.find('[data-testid="admin-nav-users"]').attributes('data-active')).toBe('true')
    expect(wrapper.find('[data-testid="admin-nav-sources"]').attributes('data-active')).toBe(
      'false',
    )
  })

  it('treats the /admin index as the Certifications section', () => {
    const wrapper = mountConsole('/admin')
    expect(wrapper.find('[data-testid="admin-nav-certifications"]').attributes('data-active')).toBe(
      'true',
    )
  })

  it('keeps a nested certifications route on the Certifications section', () => {
    const wrapper = mountConsole('/admin/certifications/new')
    expect(wrapper.find('[data-testid="admin-nav-certifications"]').attributes('data-active')).toBe(
      'true',
    )
  })
})
