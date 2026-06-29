import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrajectoryCallout from '~/components/TrajectoryCallout.vue'

describe('TrajectoryCallout', () => {
  it('renders the trajectory-callout testid when weeksToReady is provided', () => {
    const wrapper = mount(TrajectoryCallout, { props: { weeksToReady: 3 } })
    expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(true)
  })

  it('shows the number of weeks in the callout text', () => {
    const wrapper = mount(TrajectoryCallout, { props: { weeksToReady: 3 } })
    expect(wrapper.find('[data-testid="trajectory-callout"]').text()).toContain('3')
    expect(wrapper.find('[data-testid="trajectory-callout"]').text().toLowerCase()).toContain(
      'week',
    )
  })

  it('does not render anything when weeksToReady is null', () => {
    const wrapper = mount(TrajectoryCallout, { props: { weeksToReady: null } })
    expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(false)
  })

  it('shows different week counts correctly', () => {
    const wrapper = mount(TrajectoryCallout, { props: { weeksToReady: 8 } })
    expect(wrapper.find('[data-testid="trajectory-callout"]').text()).toContain('8')
  })
})
