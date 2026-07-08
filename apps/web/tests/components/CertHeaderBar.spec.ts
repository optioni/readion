import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CertHeaderBar from '~/components/CertHeaderBar.vue'

const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountBar(overrides: Partial<InstanceType<typeof CertHeaderBar>['$props']> = {}) {
  return mount(CertHeaderBar, {
    props: {
      name: 'Solutions Architect – Associate',
      provider: 'Amazon Web Services',
      code: 'SAA-C03',
      isStartingSession: false,
      isStartingMockExam: false,
      ...overrides,
    },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('CertHeaderBar', () => {
  it('renders a "← Dashboard / CODE" breadcrumb', () => {
    const wrapper = mountBar()
    expect(wrapper.text()).toMatch(/^←\s*Dashboard/)
    expect(wrapper.text()).toContain('SAA-C03')
  })

  it('omits the code segment of the breadcrumb (but keeps "← Dashboard") when no code is known', () => {
    const wrapper = mountBar({ code: '' })
    expect(wrapper.text()).toMatch(/^←\s*Dashboard/)
  })

  it('renders the certification name and provider', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="cert-detail-name"]').text()).toBe(
      'Solutions Architect – Associate',
    )
    expect(wrapper.find('[data-testid="cert-detail-provider"]').text()).toBe('Amazon Web Services')
  })

  it('renders Mock exam and Start session actions', () => {
    const wrapper = mountBar()
    expect(wrapper.text()).toContain('Mock exam')
    expect(wrapper.text()).toMatch(/Start session/)
  })

  it('emits start-mock-exam and start-session when the actions are clicked', async () => {
    const wrapper = mountBar()
    await wrapper.find('[data-testid="cert-header-mock-exam"]').trigger('click')
    await wrapper.find('[data-testid="cert-header-start-session"]').trigger('click')
    expect(wrapper.emitted('start-mock-exam')).toHaveLength(1)
    expect(wrapper.emitted('start-session')).toHaveLength(1)
  })

  it('disables the actions while they are in flight', () => {
    const wrapper = mountBar({ isStartingSession: true, isStartingMockExam: true })
    expect(
      wrapper.find('[data-testid="cert-header-mock-exam"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="cert-header-start-session"]').attributes('disabled'),
    ).toBeDefined()
  })
})
