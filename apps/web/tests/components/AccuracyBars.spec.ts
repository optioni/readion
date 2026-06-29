import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AccuracyBars from '~/components/AccuracyBars.vue'

describe('AccuracyBars', () => {
  it('renders the accuracy-bars container', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60 },
          { sessionId: 's2', accuracy: 70 },
        ],
      },
    })
    expect(wrapper.find('[data-testid="accuracy-bars"]').exists()).toBe(true)
  })

  it('renders one bar per series entry', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60 },
          { sessionId: 's2', accuracy: 70 },
          { sessionId: 's3', accuracy: 75 },
        ],
      },
    })
    const bars = wrapper.findAll('[data-testid="accuracy-bar"]')
    expect(bars).toHaveLength(3)
  })

  it('shows the accuracy percentage on each bar', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [{ sessionId: 's1', accuracy: 60 }],
      },
    })
    expect(wrapper.find('[data-testid="accuracy-bars"]').text()).toContain('60')
  })

  it('renders an empty state when series is empty', () => {
    const wrapper = mount(AccuracyBars, {
      props: { series: [] },
    })
    expect(wrapper.find('[data-testid="accuracy-bars"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="accuracy-bar"]')).toHaveLength(0)
  })
})
