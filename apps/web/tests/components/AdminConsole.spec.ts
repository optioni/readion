import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import AdminConsole from '~/components/admin/AdminConsole.vue'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import { useAuthStore } from '~/stores/auth'

vi.mock('~/composables/useAdminQuarantine', () => ({ useAdminQuarantine: vi.fn() }))

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to" :data-testid="$attrs[`data-testid`]"><slot /></a>',
}

const ADMIN_USER = {
  id: 'admin-1',
  email: 'root@readion.io',
  emailVerified: true,
  displayTimezone: 'UTC',
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'admin' as const,
}

function stubPendingCount(total: number) {
  vi.mocked(useAdminQuarantine).mockReturnValue({
    data: computed(() => ({ data: Array.from({ length: total }), meta: { total } })),
    isLoading: computed(() => false),
    isError: computed(() => false),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function mountConsole(path: string) {
  vi.stubGlobal('useRoute', () => ({ path }))
  return mount(AdminConsole, {
    slots: { default: '<div data-testid="section-content">Section</div>' },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('AdminConsole shell', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setSession('tok', ADMIN_USER)
    stubPendingCount(2)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
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

  it('renders the ADMIN eyebrow', () => {
    const wrapper = mountConsole('/admin/certifications')
    const eyebrow = wrapper.find('[data-testid="admin-sidebar-eyebrow"]')
    expect(eyebrow.exists()).toBe(true)
    expect(eyebrow.text()).toMatch(/ADMIN/)
  })

  it('renders a leading icon for every nav item', () => {
    const wrapper = mountConsole('/admin/certifications')
    for (const id of [
      'admin-nav-certifications',
      'admin-nav-review-queue',
      'admin-nav-sources',
      'admin-nav-users',
      'admin-nav-audit-log',
      'admin-nav-settings',
    ]) {
      expect(wrapper.find(`[data-testid="${id}"] svg`).exists()).toBe(true)
    }
  })

  it('shows the pending quarantine count as a badge on the Review queue item', () => {
    const wrapper = mountConsole('/admin/certifications')
    const badge = wrapper.find('[data-testid="admin-nav-review-queue-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
  })

  it('does not render the review-queue badge when there is no pending backlog', () => {
    stubPendingCount(0)
    const wrapper = mountConsole('/admin/certifications')
    expect(wrapper.find('[data-testid="admin-nav-review-queue-badge"]').exists()).toBe(false)
  })

  it('shows the signed-in admin email in the admin-session card', () => {
    const wrapper = mountConsole('/admin/certifications')
    const card = wrapper.find('[data-testid="admin-session-card"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('root@readion.io')
  })
})
