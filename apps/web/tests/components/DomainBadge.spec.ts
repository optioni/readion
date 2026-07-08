import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DomainBadge from '~/components/DomainBadge.vue'

describe('DomainBadge', () => {
  it('renders the label and score percentage', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Billing', score: 48 } })
    expect(wrapper.text()).toContain('Billing')
    expect(wrapper.text()).toContain('48%')
  })

  it('renders a status dot', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Billing', score: 48 } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').exists()).toBe(true)
  })

  it('colours the dot in the poor status colour below 50%', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Billing', score: 48 } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-poor',
    )
  })

  it('colours the dot in the warning status colour between 50 and 65%', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Security', score: 61 } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-warning',
    )
  })

  it('colours the dot in the medium status colour between 65 and 80%', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Networking', score: 70 } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-medium',
    )
  })

  it('colours the dot in the good status colour above 80%', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Pricing', score: 88 } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-good',
    )
  })

  it('applies the white hero treatment when hero is true', () => {
    const wrapper = mount(DomainBadge, { props: { label: 'Billing', score: 48, hero: true } })
    expect(wrapper.find('[data-testid="domain-badge-dot"]').classes()).toContain('bg-white')
  })
})
