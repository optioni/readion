import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadinessTrend from '~/components/ReadinessTrend.vue'

describe('ReadinessTrend', () => {
  it('renders the trend container with the readiness-trend testid', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    expect(wrapper.find('[data-testid="readiness-trend"]').exists()).toBe(true)
  })

  it('shows the current-value label when calibrated', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    const container = wrapper.find('[data-testid="readiness-trend"]')
    expect(container.text()).toContain('66')
  })

  it('renders an SVG polyline when hasData is true', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('polyline, path').exists()).toBe(true)
  })

  it('shows the not-calibrated placeholder when hasData is false', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [], hasData: false },
    })
    expect(wrapper.find('[data-testid="progress-not-calibrated"]').exists()).toBe(true)
  })

  it('does not render the SVG chart when hasData is false', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [], hasData: false },
    })
    expect(wrapper.find('svg').exists()).toBe(false)
  })
})
