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
})
