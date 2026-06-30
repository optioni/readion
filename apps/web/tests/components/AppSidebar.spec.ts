import type { RoleValue } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import AppSidebar from '~/components/AppSidebar.vue'
import type { EnrollmentCard } from '~/composables/useEnrollments'
import { useEnrollments } from '~/composables/useEnrollments'
import { useAuthStore } from '~/stores/auth'

vi.mock('~/composables/useEnrollments', () => ({ useEnrollments: vi.fn() }))

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

const mockRouterPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockRouterPush }))
vi.stubGlobal('useRoute', () => ({ path: '/' }))

let pinia: ReturnType<typeof createPinia>

function card(overrides: Partial<EnrollmentCard> & { enrollmentId: string }): EnrollmentCard {
  return {
    enrollmentId: overrides.enrollmentId,
    certificationId: overrides.certificationId ?? `${overrides.enrollmentId}-cert`,
    name: overrides.name ?? 'AWS SAA',
    provider: overrides.provider ?? 'AWS',
    readinessScore: overrides.readinessScore ?? null,
    enrolledAt: overrides.enrolledAt ?? '2026-06-01T00:00:00Z',
    status: overrides.status ?? 'active',
  }
}

function stubEnrollments(cards: EnrollmentCard[]) {
  vi.mocked(useEnrollments).mockReturnValue({
    cards: computed(() => cards),
    isLoading: computed(() => false),
    isError: computed(() => false),
  })
}

function authenticate(role: RoleValue = 'user', email = 'jamie.doe@example.com') {
  const auth = useAuthStore()
  auth.setSession('tok', {
    id: '1',
    email,
    emailVerified: true,
    displayTimezone: 'UTC',
    createdAt: '',
    role,
  })
  return auth
}

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(AppSidebar, {
    props,
    global: {
      plugins: [pinia],
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  mockRouterPush.mockReset()
  vi.restoreAllMocks()
  vi.mocked(useEnrollments).mockReset()
  stubEnrollments([card({ enrollmentId: 'enr-1' })])
  vi.stubGlobal('useRoute', () => ({ path: '/' }))
})

describe('AppSidebar structure', () => {
  it('renders the sidebar root, brand wordmark, and a primary nav landmark', () => {
    authenticate()
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Readion')
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('renders all five primary nav items with the contract testids', () => {
    authenticate()
    const wrapper = mountComponent()

    for (const testid of [
      'app-nav-dashboard',
      'app-nav-sessions',
      'app-nav-progress',
      'app-nav-agent',
      'app-nav-settings',
    ]) {
      expect(wrapper.find(`[data-testid="${testid}"]`).exists()).toBe(true)
    }
  })

  it('points static nav items at their routes', () => {
    authenticate()
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-dashboard"]').attributes('href')).toBe('/')
    expect(wrapper.find('[data-testid="app-nav-agent"]').attributes('href')).toBe('/agent')
    expect(wrapper.find('[data-testid="app-nav-settings"]').attributes('href')).toBe('/settings')
  })
})

describe('AppSidebar cert-scoped links', () => {
  it('builds Sessions and Progress links from the first active enrollment', () => {
    stubEnrollments([card({ enrollmentId: 'enr-1' })])
    authenticate()
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-sessions"]').attributes('href')).toBe(
      '/user-certifications/enr-1',
    )
    expect(wrapper.find('[data-testid="app-nav-progress"]').attributes('href')).toBe(
      '/user-certifications/enr-1/progress',
    )
  })

  it('falls back to / for cert-scoped links when there is no active enrollment', () => {
    stubEnrollments([])
    authenticate()
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-sessions"]').attributes('href')).toBe('/')
    expect(wrapper.find('[data-testid="app-nav-progress"]').attributes('href')).toBe('/')
  })
})

describe('AppSidebar active state', () => {
  it('marks only the item matching the current route active', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/settings' }))
    authenticate()
    const wrapper = mountComponent()

    const settings = wrapper.find('[data-testid="app-nav-settings"]')
    expect(settings.attributes('data-active')).toBe('true')
    expect(settings.attributes('aria-current')).toBe('page')

    for (const testid of [
      'app-nav-dashboard',
      'app-nav-sessions',
      'app-nav-progress',
      'app-nav-agent',
    ]) {
      const link = wrapper.find(`[data-testid="${testid}"]`)
      expect(link.attributes('data-active')).toBe('false')
      expect(link.attributes('aria-current')).toBeUndefined()
    }
  })

  it('marks Progress active by path prefix on a cert-scoped progress route', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/user-certifications/enr-1/progress' }))
    authenticate()
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-progress"]').attributes('data-active')).toBe('true')
    expect(wrapper.find('[data-testid="app-nav-dashboard"]').attributes('data-active')).toBe(
      'false',
    )
  })
})

describe('AppSidebar admin entry', () => {
  it('renders the admin entry only for admin users', () => {
    authenticate('admin')
    const wrapper = mountComponent()

    const admin = wrapper.find('[data-testid="app-nav-admin"]')
    expect(admin.exists()).toBe(true)
    expect(admin.attributes('href')).toBe('/admin')
  })

  it('hides the admin entry for non-admin users', () => {
    authenticate('user')
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="app-nav-admin"]').exists()).toBe(false)
  })
})

describe('AppSidebar footer user block', () => {
  it('renders initials, display name, and the dark-mode toggle', () => {
    authenticate('user', 'jamie.doe@example.com')
    const wrapper = mountComponent()

    const userBlock = wrapper.find('[data-testid="sidebar-user"]')
    expect(userBlock.exists()).toBe(true)
    expect(userBlock.text()).toContain('JA')
    expect(userBlock.text()).toContain('jamie.doe')

    const toggle = userBlock.find(
      'button[aria-label="Switch to light mode"], button[aria-label="Switch to dark mode"]',
    )
    expect(toggle.exists()).toBe(true)
  })

  it('flips and persists the theme from the footer toggle', async () => {
    window.localStorage.clear()
    document.documentElement.className = ''
    authenticate('user', 'jamie.doe@example.com')
    const wrapper = mountComponent()

    const userBlock = wrapper.find('[data-testid="sidebar-user"]')
    const toggle = userBlock.find('button[aria-label="Switch to light mode"]')
    expect(toggle.exists()).toBe(true)

    await toggle.trigger('click')

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(window.localStorage.getItem('readion-color-mode')).toBe('light')
    expect(userBlock.find('button[aria-label="Switch to dark mode"]').exists()).toBe(true)
  })
})

describe('AppSidebar responsive drawer', () => {
  it('is collapsed off-canvas on narrow viewports when closed (hidden below lg)', () => {
    authenticate()
    const wrapper = mountComponent({ open: false })

    const root = wrapper.find('[data-testid="app-sidebar"]')
    const classes = root.classes()
    expect(classes).toContain('hidden')
    expect(classes).toContain('lg:flex')
    expect(classes).not.toContain('fixed')
  })

  it('renders as an overlay drawer when open', () => {
    authenticate()
    const wrapper = mountComponent({ open: true })

    const root = wrapper.find('[data-testid="app-sidebar"]')
    const classes = root.classes()
    expect(classes).toContain('flex')
    expect(classes).toContain('fixed')
    expect(classes).not.toContain('hidden')
  })

  it('emits close from the drawer close control', async () => {
    authenticate()
    const wrapper = mountComponent({ open: true })

    const close = wrapper.find('[data-testid="sidebar-drawer-close"]')
    expect(close.exists()).toBe(true)
    expect(close.attributes('aria-label')).toMatch(/close navigation/i)

    await close.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

describe('AppSidebar logout', () => {
  it('calls /auth/logout, clears the auth store, and navigates to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    const auth = authenticate()
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="logout-btn"]').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(auth.isAuthenticated).toBe(false)
    expect(mockRouterPush).toHaveBeenCalledWith('/login')
  })
})
