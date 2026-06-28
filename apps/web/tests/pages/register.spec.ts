import { flushPromises, mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '~/pages/register.vue'
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

function mountRegister() {
  return mount(RegisterPage, {
    global: { plugins: [pinia] },
  })
}

describe('/register page', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockRouterPush.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks submission when password is fewer than 8 characters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const wrapper = mountRegister()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('short')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores the access token and navigates onward on successful registration', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { accessToken: 'tok' } }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: '1',
              email: 'a@b.com',
              emailVerified: false,
              displayTimezone: 'UTC',
              createdAt: '',
            },
          }),
          { status: 200 },
        ),
      )

    const auth = useAuthStore()
    const wrapper = mountRegister()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('validpass1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(auth.isAuthenticated).toBe(true)
    expect(mockRouterPush).toHaveBeenCalled()

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toBe('http://localhost:3001/api/v1/auth/register')
    expect(urls[1]).toBe('http://localhost:3001/api/v1/users/me')
    for (const url of urls) {
      expect(url).not.toContain('/api/v1/api/v1')
    }
  })

  it('renders field-level errors from a 422 problem-details response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'validation-error',
          title: 'Validation failed',
          status: 422,
          errors: [{ path: 'password', message: 'Password is too weak' }],
        }),
        { status: 422, headers: { 'content-type': 'application/problem+json' } },
      ),
    )

    const auth = useAuthStore()
    const wrapper = mountRegister()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('validpass1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.html()).toContain('Password is too weak')
    expect(auth.isAuthenticated).toBe(false)
  })

  it('shows "email already registered" on 409 duplicate email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Conflict', status: 409 }), {
        status: 409,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )

    const wrapper = mountRegister()
    await wrapper.find('input[type="email"]').setValue('exists@b.com')
    await wrapper.find('input[type="password"]').setValue('validpass1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.html()).toContain('email already registered')
  })
})
