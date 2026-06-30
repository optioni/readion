import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrajectoryCallout from '~/components/TrajectoryCallout.vue'

describe('TrajectoryCallout', () => {
  describe('calibrated branch (weeksToReady is non-null)', () => {
    it('renders the trajectory-callout testid', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(true)
    })

    it('contains "recent pace" and "session avg" phrasing', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      const text = wrapper.find('[data-testid="trajectory-callout"]').text().toLowerCase()
      expect(text).toContain('recent pace')
      expect(text).toContain('session avg')
    })

    it('shows the pace rate value', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').text()).toContain('5.5')
    })

    it('shows the number of weeks', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').text()).toContain('3')
      expect(wrapper.find('[data-testid="trajectory-callout"]').text().toLowerCase()).toContain(
        'week',
      )
    })

    it('pluralises "week" when weeksToReady > 1', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 2.0 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').text().toLowerCase()).toContain(
        'weeks',
      )
    })

    it('uses singular "week" when weeksToReady is 1', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 1, paceRate: 10.0 },
      })
      const text = wrapper.find('[data-testid="trajectory-callout"]').text()
      expect(text).toContain('1 week')
      expect(text).not.toContain('1 weeks')
    })

    it('renders an SVG trend icon in the calibrated branch', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"] svg').exists()).toBe(true)
    })

    it('does NOT render the insufficient testid in the calibrated branch', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 3, paceRate: 5.5 },
      })
      expect(wrapper.find('[data-testid="trajectory-insufficient"]').exists()).toBe(false)
    })

    it('shows different week counts correctly', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: 8, paceRate: 2.0 },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').text()).toContain('8')
    })
  })

  describe('uncalibrated/insufficient branch (weeksToReady is null)', () => {
    it('does NOT render trajectory-callout testid', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: null, paceRate: null },
      })
      expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(false)
    })

    it('renders the trajectory-insufficient testid', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: null, paceRate: null },
      })
      expect(wrapper.find('[data-testid="trajectory-insufficient"]').exists()).toBe(true)
    })

    it('shows "complete at least N sessions" hint', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: null, paceRate: null },
      })
      const text = wrapper.find('[data-testid="trajectory-insufficient"]').text().toLowerCase()
      expect(text).toContain('complete at least')
      expect(text).toContain('sessions')
    })

    it('does not show pace rate or weeks in the insufficient branch', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: null, paceRate: null },
      })
      const text = wrapper.find('[data-testid="trajectory-insufficient"]').text().toLowerCase()
      expect(text).not.toContain('recent pace')
      expect(text).not.toContain('session avg')
      expect(text).not.toContain('week')
    })

    it('renders an info SVG icon in the insufficient branch', () => {
      const wrapper = mount(TrajectoryCallout, {
        props: { weeksToReady: null, paceRate: null },
      })
      expect(wrapper.find('[data-testid="trajectory-insufficient"] svg').exists()).toBe(true)
    })
  })
})
