import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CertSetupIdentifyStep from '~/components/admin/CertSetupIdentifyStep.vue'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'

function buildState(): CertSetupWizardState {
  return {
    step: 1,
    name: '',
    code: '',
    knownSourceUrl: null,
    discoveryCandidates: [],
    confirmedSourceUrl: null,
    extractionJobId: null,
    fields: null,
    fieldValues: {
      domains: null,
      questionCount: null,
      passingScore: null,
      timeLimitMinutes: null,
    },
    manualFields: [],
    identity: { name: '', provider: '', code: '' },
    suggestedContentSources: [],
    createdCertId: null,
  }
}

function mountStep(state = buildState()) {
  const submitIdentity = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(CertSetupIdentifyStep, { props: { state, submitIdentity } })
  return { wrapper, submitIdentity }
}

describe('CertSetupIdentifyStep', () => {
  it('renders a standalone identify screen with an intro, all fields, and a next-steps callout', () => {
    const { wrapper } = mountStep()

    expect(wrapper.find('[data-testid="cert-identify-step"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-intro"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-name-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-code-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-code-hint"]').text()).toContain('de-duplicate')
    expect(wrapper.find('[data-testid="identify-provider-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-known-url-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="identify-next-callout"]').exists()).toBe(true)
  })

  it('disables the CTA until both name and code are filled', async () => {
    const { wrapper } = mountStep()
    const cta = wrapper.find('[data-testid="identify-search-btn"]')
    expect(cta.attributes('disabled')).toBeDefined()

    await wrapper
      .find('[data-testid="identify-name-input"]')
      .setValue('Certified Kubernetes Security Specialist')
    expect(wrapper.find('[data-testid="identify-search-btn"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="identify-code-input"]').setValue('CKS')
    expect(
      wrapper.find('[data-testid="identify-search-btn"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('the next-steps callout reflects the entered code', async () => {
    const { wrapper } = mountStep()

    await wrapper.find('[data-testid="identify-code-input"]').setValue('CKS')
    expect(wrapper.find('[data-testid="identify-next-callout"]').text()).toContain('CKS')
  })

  it('submits the identity fields (name, code, certifying body, known URL) on CTA click', async () => {
    const { wrapper, submitIdentity } = mountStep()

    await wrapper
      .find('[data-testid="identify-name-input"]')
      .setValue('Certified Kubernetes Security Specialist')
    await wrapper.find('[data-testid="identify-code-input"]').setValue('CKS')
    await wrapper
      .find('[data-testid="identify-provider-input"]')
      .setValue('CNCF / Linux Foundation')
    await wrapper
      .find('[data-testid="identify-known-url-input"]')
      .setValue('https://training.linuxfoundation.org/certification/cks/')
    await wrapper.find('[data-testid="identify-search-btn"]').trigger('click')

    expect(submitIdentity).toHaveBeenCalledWith(
      'Certified Kubernetes Security Specialist',
      'CKS',
      'CNCF / Linux Foundation',
      'https://training.linuxfoundation.org/certification/cks/',
    )
  })

  it('surfaces a problem-details error from submitIdentity without advancing', async () => {
    const state = buildState()
    const submitIdentity = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mount(CertSetupIdentifyStep, { props: { state, submitIdentity } })

    await wrapper.find('[data-testid="identify-name-input"]').setValue('CKS cert')
    await wrapper.find('[data-testid="identify-code-input"]').setValue('CKS')
    await wrapper.find('[data-testid="identify-search-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(wrapper.find('[data-testid="identify-error"]').exists()).toBe(true)
  })

  it('emits a cancel that navigates away without submitting', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Nuxt auto-import stub for this unit test
    const navigateTo = vi.fn()
    vi.stubGlobal('navigateTo', navigateTo)
    const { wrapper, submitIdentity } = mountStep()

    await wrapper.find('[data-testid="identify-cancel-btn"]').trigger('click')

    expect(navigateTo).toHaveBeenCalledWith('/admin/certifications')
    expect(submitIdentity).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
