import { flushPromises, mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '~/pages/login.vue'
import { useAuthStore } from '~/stores/auth'

vi.mock('~/composables/useAuthBootstrap', () => ({ runAuthBootstrap: vi.fn() }))

const mockRouterPush = vi.fn()
const mockRoute = { query: {} }
vi.stubGlobal('useRouter', () => ({ push: mockRouterPush }))
vi.stubGlobal('useRoute', () => mockRoute)
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001' },
}))

let pinia: Pinia

function mountLogin() {
  return mount(LoginPage, {
    global: { plugins: [pinia] },
  })
}

describe('/login page', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockRouterPush.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores the access token and navigates to home on successful login', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { accessToken: 'tok' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: '1',
              email: 'a@b.com',
              emailVerified: true,
              displayTimezone: 'UTC',
              createdAt: '',
            },
          }),
          { status: 200 },
        ),
      )

    const auth = useAuthStore()
    const wrapper = mountLogin()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(auth.isAuthenticated).toBe(true)
    expect(mockRouterPush).toHaveBeenCalledWith('/')

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toBe('http://localhost:3001/api/v1/auth/login')
    expect(urls[1]).toBe('http://localhost:3001/api/v1/users/me')
    for (const url of urls) {
      expect(url).not.toContain('/api/v1/api/v1')
    }
  })

  it('shows a uniform error message and stays on /login on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )

    const auth = useAuthStore()
    const wrapper = mountLogin()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('wrongpass')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="login-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Incorrect email or password')
    expect(auth.isAuthenticated).toBe(false)
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('keeps SSO and the "or" divider omitted (preserved divergence)', () => {
    const wrapper = mountLogin()
    const html = wrapper.html()

    expect(html).not.toMatch(/sso/i)
    expect(wrapper.findAll('button').some((b) => /sso/i.test(b.text()))).toBe(false)
    expect(wrapper.findAll('*').some((el) => el.text().trim().toLowerCase() === 'or')).toBe(false)
  })

  it('does not show per-field error messages on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )

    const wrapper = mountLogin()
    await wrapper.find('input[type="email"]').setValue('x@y.com')
    await wrapper.find('input[type="password"]').setValue('bad')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.html()).not.toContain('No account found')
    expect(wrapper.html()).not.toContain('no account')
  })
})
