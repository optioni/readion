import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SetupHeader from '~/components/admin/SetupHeader.vue'

function mountHeader(step: 1 | 2 | 3 | 4 | 5, props: Record<string, unknown> = {}) {
  return mount(SetupHeader, { props: { step, ...props } })
}

describe('SetupHeader', () => {
  it('renders a breadcrumb, a step-1 indicator and a progress bar at the first step', () => {
    const wrapper = mountHeader(1)

    expect(wrapper.find('[data-testid="setup-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="setup-header-breadcrumb"]').text()).toContain(
      'Certifications',
    )
    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 1 of 5 · Identify certification',
    )
    expect(wrapper.find('[data-testid="setup-header-progress"]').attributes('style')).toContain(
      'width: 20%',
    )
    expect(wrapper.find('[data-testid="setup-header-cancel"]').exists()).toBe(true)
  })

  it('advances the step indicator and progress bar for step 2', () => {
    const wrapper = mountHeader(2)

    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 2 of 5 · Source confirmation',
    )
    expect(wrapper.find('[data-testid="setup-header-progress"]').attributes('style')).toContain(
      'width: 40%',
    )
  })

  it('shows the field extraction and content sources labels at steps 3 and 4', () => {
    expect(mountHeader(3).find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 3 of 5 · Field extraction',
    )
    expect(mountHeader(4).find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 4 of 5 · Content sources',
    )
  })

  it('emits cancel when the cancel affordance is activated', async () => {
    const wrapper = mountHeader(1)

    await wrapper.find('[data-testid="setup-header-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('defaults the breadcrumb tail to "New" and the title to "New certification" with no code/name yet', () => {
    const wrapper = mountHeader(1)

    expect(wrapper.find('[data-testid="setup-header-breadcrumb"]').text()).toContain(
      'Certifications › New',
    )
    expect(wrapper.find('[data-testid="setup-header-title"]').text()).toBe('New certification')
  })

  it('reflects the entered cert code in the breadcrumb and the cert name as the header title', () => {
    const wrapper = mountHeader(2, {
      code: 'CKS',
      certName: 'Certified Kubernetes Security Specialist',
    })

    expect(wrapper.find('[data-testid="setup-header-breadcrumb"]').text()).toContain(
      'Certifications › New › CKS',
    )
    expect(wrapper.find('[data-testid="setup-header-title"]').text()).toBe(
      'Certified Kubernetes Security Specialist',
    )
  })
})
