import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '~/pages/forgot-password.vue'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBaseUrl: 'http://localhost:3001/api/v1' },
}))

function mountPage() {
  return mount(ForgotPasswordPage)
}

describe('/forgot-password page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the same neutral confirmation on 202 regardless of whether email exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 202 }))

    const wrapper = mountPage()
    await wrapper.find('input[type="email"]').setValue('any@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.html()).toContain('if an account exists')
  })

  it('does not reveal whether an account exists on 202', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 202 }))

    const wrapper = mountPage()
    await wrapper.find('input[type="email"]').setValue('nope@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.html()).not.toContain('not found')
    expect(wrapper.html()).not.toContain('does not exist')
    expect(wrapper.html()).toContain('if an account exists')
  })
})
