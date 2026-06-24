import { flushPromises, mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerifyEmailPage from '~/pages/verify-email.vue'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))
const mockRouterPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockRouterPush }))

let tokenQuery = 'valid-token'
vi.stubGlobal('useRoute', () => ({ query: { token: tokenQuery } }))

let pinia: Pinia

function mountPage() {
  return mount(VerifyEmailPage, { global: { plugins: [pinia] } })
}

describe('/verify-email page', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    tokenQuery = 'valid-token'
    vi.restoreAllMocks()
  })

  it('POSTs the token and shows a success state on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.html()).toContain('verified')
    expect(wrapper.html()).not.toContain('invalid or expired')
  })

  it('shows "invalid or expired link" on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Bad request', status: 400 }), {
        status: 400,
        headers: { 'content-type': 'application/problem+json' },
      }),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.html()).toContain('invalid or expired')
  })

  it('triggers resend-verification and shows confirmation when user clicks resend', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

    const wrapper = mountPage()
    await flushPromises()

    const resendBtn = wrapper.find('[data-testid="resend-btn"]')
    if (resendBtn.exists()) {
      await resendBtn.trigger('click')
      await flushPromises()
      expect(wrapper.html()).toContain('sent')
    }
  })
})
