import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SetupHeader from '~/components/admin/SetupHeader.vue'

function mountHeader(step: 1 | 2 | 3 | 4) {
  return mount(SetupHeader, { props: { step } })
}

describe('SetupHeader', () => {
  it('renders a breadcrumb, a step-1 indicator and a progress bar at the first step', () => {
    const wrapper = mountHeader(1)

    expect(wrapper.find('[data-testid="setup-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="setup-header-breadcrumb"]').text()).toContain(
      'Certifications',
    )
    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 1 of 4 · Source search',
    )
    expect(wrapper.find('[data-testid="setup-header-progress"]').attributes('style')).toContain(
      'width: 25%',
    )
    expect(wrapper.find('[data-testid="setup-header-cancel"]').exists()).toBe(true)
  })

  it('advances the step indicator and progress bar for step 2', () => {
    const wrapper = mountHeader(2)

    expect(wrapper.find('[data-testid="setup-header-step-indicator"]').text()).toBe(
      'Step 2 of 4 · Field extraction',
    )
    expect(wrapper.find('[data-testid="setup-header-progress"]').attributes('style')).toContain(
      'width: 50%',
    )
  })

  it('emits cancel when the cancel affordance is activated', async () => {
    const wrapper = mountHeader(1)

    await wrapper.find('[data-testid="setup-header-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
