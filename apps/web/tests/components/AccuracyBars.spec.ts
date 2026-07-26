import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AccuracyBars from '~/components/AccuracyBars.vue'

describe('AccuracyBars', () => {
  it('renders the accuracy-bars container', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 70, label: 'Jun 5' },
        ],
      },
    })
    expect(wrapper.find('[data-testid="accuracy-bars"]').exists()).toBe(true)
  })

  it('renders one bar per series entry', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 70, label: 'Jun 5' },
          { sessionId: 's3', accuracy: 75, label: 'Jun 9' },
        ],
      },
    })
    const bars = wrapper.findAll('[data-testid="accuracy-bar"]')
    expect(bars).toHaveLength(3)
  })

  it('shows the accuracy percentage only on the last (most recent) bar (5.4)', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 70, label: 'Jun 5' },
        ],
      },
    })
    const bars = wrapper.findAll('[data-testid="accuracy-bar"]')
    expect(bars[0]!.find('[data-testid="accuracy-bar-percent"]').exists()).toBe(false)
    expect(bars[1]!.find('[data-testid="accuracy-bar-percent"]').text()).toContain('70')
  })

  it('shows a short date caption beneath every bar (5.4)', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 70, label: 'Jun 5' },
        ],
      },
    })
    const bars = wrapper.findAll('[data-testid="accuracy-bar"]')
    expect(bars[0]!.find('[data-testid="accuracy-bar-caption"]').text()).toBe('Jun 1')
    expect(bars[1]!.find('[data-testid="accuracy-bar-caption"]').text()).toBe('Jun 5')
  })

  it('constrains long captions within each responsive bar column', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Long localized April 3' },
          { sessionId: 's2', accuracy: 70, label: 'Long localized May 3' },
        ],
      },
    })
    expect(wrapper.get('[data-testid="accuracy-bars"]').classes()).toContain('min-w-0')
    for (const caption of wrapper.findAll('[data-testid="accuracy-bar-caption"]')) {
      expect(caption.classes()).toEqual(expect.arrayContaining(['w-full', 'truncate']))
    }
  })

  it('renders one bar fill per series entry with positive accuracy-proportional pixel heights', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 75, label: 'Jun 5' },
        ],
      },
    })
    const fills = wrapper.findAll('[data-testid="accuracy-bar-fill"]')
    expect(fills).toHaveLength(2)

    const heightPx = (el: (typeof fills)[number] | undefined): number => {
      expect(el).toBeDefined()
      const style = el?.attributes('style') ?? ''
      const match = style.match(/height:\s*([\d.]+)px/)
      const value = match?.[1]
      expect(value).toBeDefined()
      return Number.parseFloat(value ?? '0')
    }

    const first = heightPx(fills[0])
    const second = heightPx(fills[1])
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
  })

  it('emphasizes the latest (last) bar fill differently from the others', () => {
    const wrapper = mount(AccuracyBars, {
      props: {
        series: [
          { sessionId: 's1', accuracy: 60, label: 'Jun 1' },
          { sessionId: 's2', accuracy: 70, label: 'Jun 5' },
          { sessionId: 's3', accuracy: 75, label: 'Jun 9' },
        ],
      },
    })
    const fills = wrapper.findAll('[data-testid="accuracy-bar-fill"]')
    const latest = fills.at(-1)
    const others = fills.slice(0, -1)

    expect(latest).toBeDefined()
    expect(latest?.classes()).toContain('bg-readion-primary')
    for (const other of others) {
      expect(other.classes()).not.toContain('bg-readion-primary')
    }
  })

  it('renders an empty state when series is empty', () => {
    const wrapper = mount(AccuracyBars, {
      props: { series: [] },
    })
    expect(wrapper.find('[data-testid="accuracy-bars"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="accuracy-bar"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="accuracy-bar-fill"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="accuracy-bars"]').text()).toContain('No accuracy data yet')
  })
})
