import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProgressStatCard from '~/components/ProgressStatCard.vue'

describe('ProgressStatCard', () => {
  it('renders with data-testid="progress-stat-card"', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '5' },
    })
    expect(wrapper.find('[data-testid="progress-stat-card"]').exists()).toBe(true)
  })

  it('displays the label', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Questions answered', value: '24' },
    })
    expect(wrapper.text()).toContain('Questions answered')
  })

  it('displays the value', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Study time', value: '3h' },
    })
    expect(wrapper.text()).toContain('3h')
  })

  it('displays the optional unit when provided', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Current streak', value: '1', unit: 'days' },
    })
    expect(wrapper.text()).toContain('days')
  })

  it('omits the unit when not provided', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '5' },
    })
    expect(wrapper.text()).not.toContain('days')
  })

  it('applies the optional unitClass to the unit span', () => {
    const wrapper = mount(ProgressStatCard, {
      props: {
        label: 'Questions',
        value: '44',
        unit: '72%',
        unitClass: 'text-readion-status-medium',
      },
    })
    const unit = wrapper.findAll('span').find((span) => span.text() === '72%')
    expect(unit?.classes()).toContain('text-readion-status-medium')
  })

  it('applies the optional valueClass to the value span', () => {
    const wrapper = mount(ProgressStatCard, {
      props: {
        label: 'Avg accuracy',
        value: '72%',
        valueClass: 'text-readion-status-medium',
      },
    })
    const value = wrapper.findAll('span').find((span) => span.text() === '72%')
    expect(value?.classes()).toContain('text-readion-status-medium')
  })

  it('defaults the value colour when valueClass is not provided', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '5' },
    })
    const value = wrapper.findAll('span').find((span) => span.text() === '5')
    expect(value?.classes()).toContain('text-slate-100')
  })

  it('renders as its own bordered, rounded card (4.1/5.3)', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '5' },
    })
    const classes = wrapper.find('[data-testid="progress-stat-card"]').classes()
    expect(classes.some((c) => c.includes('border'))).toBe(true)
    expect(classes.some((c) => c.includes('rounded'))).toBe(true)
  })

  it('shows the optional sub-caption beneath the value (4.1)', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '14', subCaption: 'completed' },
    })
    expect(wrapper.text()).toContain('completed')
  })

  it('omits the sub-caption when not provided', () => {
    const wrapper = mount(ProgressStatCard, {
      props: { label: 'Sessions', value: '14' },
    })
    expect(wrapper.find('[data-testid="progress-stat-sub-caption"]').exists()).toBe(false)
  })
})
