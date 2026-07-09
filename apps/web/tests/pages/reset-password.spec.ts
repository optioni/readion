import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPasswordPage from '~/pages/reset-password.vue'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

const mockRouterPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockRouterPush }))

let tokenQuery = 'valid-reset-token'
vi.stubGlobal('useRoute', () => ({ query: { token: tokenQuery } }))

function mountPage() {
  return mount(ResetPasswordPage)
}

describe('/reset-password page', () => {
  beforeEach(() => {
    tokenQuery = 'valid-reset-token'
    mockRouterPush.mockReset()
    vi.restoreAllMocks()
  })

  it('shows the new-password form when token validation returns 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('invalid or expired')
  })

  it('shows "invalid or expired link" and no form on 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Bad request', status: 400 }), {
        status: 400,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.html()).toContain('invalid or expired')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('navigates to /login with confirmation on successful password reset', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

    const wrapper = mountPage()
    await flushPromises()

    const passwordInput = wrapper.find('input[type="password"]')
    const confirmInput = wrapper.find('[data-testid="confirm-password-input"]')
    await passwordInput.setValue('newstrongpassword')
    await confirmInput.setValue('newstrongpassword')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockRouterPush).toHaveBeenCalledWith(expect.objectContaining({ path: '/login' }))
  })

  it('enforces the minimum password strength rule before submitting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const wrapper = mountPage()
    await flushPromises()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockClear()
    await wrapper.find('input[type="password"]').setValue('short')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders a confirm-password field beneath the new-password field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Confirm password')
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="confirm-password-input"]').exists()).toBe(true)
  })

  it('blocks submit with an inline mismatch message when the confirmation differs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const wrapper = mountPage()
    await flushPromises()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockClear()

    await wrapper.find('input[type="password"]').setValue('newstrongpassword')
    await wrapper.find('[data-testid="confirm-password-input"]').setValue('somethingelse')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-password-mismatch"]').exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).toContain('passwords do not match')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows the success indicator and allows submit when the confirmation matches', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('input[type="password"]').setValue('newstrongpassword')
    await wrapper.find('[data-testid="confirm-password-input"]').setValue('newstrongpassword')

    expect(wrapper.find('[data-testid="confirm-password-success"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-password-mismatch"]').exists()).toBe(false)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockRouterPush).toHaveBeenCalledWith(expect.objectContaining({ path: '/login' }))
  })
})
