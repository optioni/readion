import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppNavBar from '~/components/AppNavBar.vue'
import { useAuthStore } from '~/stores/auth'

vi.stubGlobal('defineNuxtLink', { name: 'NuxtLink', template: '<a><slot /></a>' })
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

const mockRouterPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockRouterPush }))
vi.stubGlobal('useRoute', () => ({ path: '/' }))

let pinia: ReturnType<typeof createPinia>

function mountComponent() {
  return mount(AppNavBar, {
    global: {
      plugins: [pinia],
      stubs: { NuxtLink: { template: '<a><slot /></a>' }, ColorModeToggle: true },
    },
  })
}

describe('AppNavBar logout', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockRouterPush.mockReset()
    vi.restoreAllMocks()
  })

  it('calls /auth/logout, clears the auth store, and navigates to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const auth = useAuthStore()
    auth.setSession('tok', {
      id: '1',
      email: 'u@example.com',
      emailVerified: true,
      displayTimezone: 'UTC',
      createdAt: '',
      role: 'user',
    })

    const wrapper = mountComponent()
    await wrapper.find('[data-testid="logout-btn"]').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(mockRouterPush).toHaveBeenCalledWith('/login')
  })

  it('still clears the store and navigates to /login even when logout request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const auth = useAuthStore()
    auth.setSession('tok', {
      id: '1',
      email: 'u@example.com',
      emailVerified: true,
      displayTimezone: 'UTC',
      createdAt: '',
      role: 'user',
    })

    const wrapper = mountComponent()
    await wrapper.find('[data-testid="logout-btn"]').trigger('click')
    await flushPromises()

    expect(auth.isAuthenticated).toBe(false)
    expect(mockRouterPush).toHaveBeenCalledWith('/login')
  })
})

describe('AppNavBar settings nav', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.restoreAllMocks()
  })

  function authenticate() {
    const auth = useAuthStore()
    auth.setSession('tok', {
      id: '1',
      email: 'u@example.com',
      emailVerified: true,
      displayTimezone: 'UTC',
      createdAt: '',
      role: 'user',
    })
    return auth
  }

  it('marks the Settings nav affordance active when on /settings', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/settings' }))
    authenticate()

    const wrapper = mountComponent()
    const link = wrapper.find('[data-testid="app-nav-settings"]')

    expect(link.exists()).toBe(true)
    expect(link.attributes('data-active')).toBe('true')
  })

  it('marks the Settings nav affordance inactive on other routes', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/' }))
    authenticate()

    const wrapper = mountComponent()
    const link = wrapper.find('[data-testid="app-nav-settings"]')

    expect(link.exists()).toBe(true)
    expect(link.attributes('data-active')).toBe('false')
  })

  it('does not render the Settings nav affordance when unauthenticated', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/settings' }))

    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-settings"]').exists()).toBe(false)
  })
})
