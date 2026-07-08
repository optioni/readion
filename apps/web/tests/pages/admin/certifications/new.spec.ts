import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import NewCertPage from '~/pages/admin/certifications/new.vue'
import { useAuthStore } from '~/stores/auth'

vi.mock('~~/src/api/cert-setup/cert-setup')
vi.mock('~/composables/useAdminQuarantine', () => ({ useAdminQuarantine: vi.fn() }))

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

beforeEach(() => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.setSession('tok', {
    id: 'admin-1',
    email: 'root@readion.io',
    emailVerified: true,
    displayTimezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: 'admin',
  })
  vi.mocked(useAdminQuarantine).mockReturnValue({
    data: computed(() => ({ data: [], meta: { total: 0, page: 1, limit: 20 } })),
    isLoading: computed(() => false),
    isError: computed(() => false),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Admin cert setup page', () => {
  it('wraps the cert setup wizard inside the admin console', () => {
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('useRoute', () => ({ path: '/admin/certifications/new' }))

    const wrapper = mount(NewCertPage, {
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })

    expect(wrapper.find('[data-testid="admin-console"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-cert-setup-page"]').exists()).toBe(true)
  })
})
