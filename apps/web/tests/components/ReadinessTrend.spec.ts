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
    expect(container.text()).toContain('66%')
  })

  it('renders an SVG polyline when hasData is true', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('polyline, path').exists()).toBe(true)
  })

  it('renders a circle marker per data point', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    const circles = wrapper.findAll('[data-testid="readiness-point"]')
    expect(circles).toHaveLength(3)
  })

  it('emphasizes the last point with a larger radius than the others', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    const circles = wrapper.findAll('[data-testid="readiness-point"]')
    const lastR = Number(circles[circles.length - 1]?.attributes('r'))
    const firstR = Number(circles[0]?.attributes('r'))
    expect(lastR).toBeGreaterThan(firstR)
  })

  it('renders y-axis tick labels on a 0-100 scale', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    const text = wrapper.find('[data-testid="readiness-trend"]').text()
    // textContent in jsdom concatenates SVG text nodes without separators;
    // the presence check (no \b) is sufficient here — the e2e test covers word-boundary rendering.
    expect(text).toMatch(/(50|75)/)
  })

  it('shows the current value as a percentage label', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [55, 62, 66], hasData: true },
    })
    expect(wrapper.find('[data-testid="readiness-trend"]').text()).toContain('66%')
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

  it('does not render point markers or axis ticks in the not-calibrated state', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [], hasData: false },
    })
    expect(wrapper.findAll('[data-testid="readiness-point"]')).toHaveLength(0)
    const text = wrapper.find('[data-testid="readiness-trend"]').text()
    expect(text).not.toMatch(/\b(25|50|75|100)\b/)
  })
})
