import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NewCertPage from '~/pages/admin/certifications/new.vue'

vi.mock('~~/src/api/cert-setup/cert-setup')

const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

afterEach(() => {
  vi.unstubAllGlobals()
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
