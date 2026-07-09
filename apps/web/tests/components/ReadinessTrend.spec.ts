import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadinessTrend from '~/components/ReadinessTrend.vue'

const POINTS = [
  { score: 55, label: 'Jun 1' },
  { score: 62, label: 'Jun 10' },
  { score: 66, label: 'Jun 20' },
]

describe('ReadinessTrend', () => {
  it('renders the trend container with the readiness-trend testid', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    expect(wrapper.find('[data-testid="readiness-trend"]').exists()).toBe(true)
  })

  it('shows the current-value label when calibrated', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    const container = wrapper.find('[data-testid="readiness-trend"]')
    expect(container.text()).toContain('66%')
  })

  it('renders an SVG polyline when hasData is true', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('polyline, path').exists()).toBe(true)
  })

  it('renders a circle marker per data point', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    const circles = wrapper.findAll('[data-testid="readiness-point"]')
    expect(circles).toHaveLength(3)
  })

  it('emphasizes the last point with a larger radius than the others', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    const circles = wrapper.findAll('[data-testid="readiness-point"]')
    const lastR = Number(circles[circles.length - 1]?.attributes('r'))
    const firstR = Number(circles[0]?.attributes('r'))
    expect(lastR).toBeGreaterThan(firstR)
  })

  it('renders y-axis tick labels on a 0-100 scale', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    const text = wrapper.find('[data-testid="readiness-trend"]').text()
    // textContent in jsdom concatenates SVG text nodes without separators;
    // the presence check (no \b) is sufficient here — the e2e test covers word-boundary rendering.
    expect(text).toMatch(/(50|75)/)
  })

  it('shows the current value as a percentage label', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
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

describe('ReadinessTrend — 80% target line (6.1)', () => {
  it('renders a visible 80% target reference line when calibrated', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    expect(wrapper.find('[data-testid="readiness-target-line"]').exists()).toBe(true)
  })

  it('shows an "80% target" label distinct from the plain gridlines', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true },
    })
    expect(wrapper.find('[data-testid="readiness-trend"]').text()).toMatch(/80%\s*target/i)
  })

  it('does not render the target line or label in the not-calibrated state', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: [], hasData: false },
    })
    expect(wrapper.find('[data-testid="readiness-target-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-not-calibrated"]').text()).not.toMatch(/target/i)
  })
})

describe('ReadinessTrend — X-axis labels, area fill, projection (5.2)', () => {
  it('renders first/middle/last X-axis date labels', () => {
    const wrapper = mount(ReadinessTrend, { props: { points: POINTS, hasData: true } })
    const labels = wrapper.findAll('[data-testid="readiness-x-label"]')
    expect(labels).toHaveLength(3)
    expect(labels[0]?.text()).toBe('Jun 1')
    expect(labels[1]?.text()).toBe('Jun 10')
    expect(labels[2]?.text()).toBe('Jun 20')
  })

  it('renders an area fill under the line', () => {
    const wrapper = mount(ReadinessTrend, { props: { points: POINTS, hasData: true } })
    expect(wrapper.find('[data-testid="readiness-area-fill"]').exists()).toBe(true)
  })

  it('renders a dashed projection segment toward the target when showProjection is true', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true, showProjection: true },
    })
    const projection = wrapper.find('[data-testid="readiness-projection"]')
    expect(projection.exists()).toBe(true)
    expect(projection.attributes('stroke-dasharray')).toBeTruthy()
  })

  it('omits the projection segment when showProjection is false', () => {
    const wrapper = mount(ReadinessTrend, {
      props: { points: POINTS, hasData: true, showProjection: false },
    })
    expect(wrapper.find('[data-testid="readiness-projection"]').exists()).toBe(false)
  })
})
