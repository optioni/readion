import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadinessAccuracyCard from '~/components/ReadinessAccuracyCard.vue'

describe('ReadinessAccuracyCard', () => {
  it('composes readiness trend and accuracy bars into one surface card, not two side-by-side cards', () => {
    const wrapper = mount(ReadinessAccuracyCard, {
      props: {
        points: [55, 62, 66],
        hasData: true,
        series: [
          { sessionId: 's1', accuracy: 60 },
          { sessionId: 's2', accuracy: 70 },
        ],
      },
    })

    const card = wrapper.find('[data-testid="readiness-accuracy-card"]')
    expect(card.exists()).toBe(true)
    expect(card.find('[data-testid="readiness-trend"]').exists()).toBe(true)
    expect(card.find('[data-testid="accuracy-bars"]').exists()).toBe(true)

    // Only one shared card background — the two sub-components must not each carry their own
    // card chrome (that would render as two separate cards rather than one composed surface).
    expect(card.classes()).toEqual(
      expect.arrayContaining(['rounded-md', 'bg-black/25']),
    )
    expect(card.find('[data-testid="readiness-trend"]').classes()).not.toContain('bg-black/25')
    expect(card.find('[data-testid="accuracy-bars"]').classes()).not.toContain('bg-black/25')
  })

  it('renders the readiness trend above a divider, and the accuracy bars below it', () => {
    const wrapper = mount(ReadinessAccuracyCard, {
      props: {
        points: [55, 62, 66],
        hasData: true,
        series: [{ sessionId: 's1', accuracy: 60 }],
      },
    })

    const html = wrapper.html()
    const readinessIndex = html.indexOf('data-testid="readiness-trend"')
    const dividerIndex = html.indexOf('data-testid="readiness-accuracy-divider"')
    const accuracyIndex = html.indexOf('data-testid="accuracy-bars"')

    expect(readinessIndex).toBeGreaterThanOrEqual(0)
    expect(dividerIndex).toBeGreaterThan(readinessIndex)
    expect(accuracyIndex).toBeGreaterThan(dividerIndex)
  })

  it('shows the 80% target line on the readiness portion', () => {
    const wrapper = mount(ReadinessAccuracyCard, {
      props: {
        points: [55, 62, 66],
        hasData: true,
        series: [{ sessionId: 's1', accuracy: 60 }],
      },
    })
    expect(wrapper.find('[data-testid="readiness-target-line"]').exists()).toBe(true)
  })

  it('renders friendly low-data states for both portions, not slider-looking flat lines', () => {
    const wrapper = mount(ReadinessAccuracyCard, {
      props: { points: [], hasData: false, series: [] },
    })

    expect(wrapper.find('[data-testid="progress-not-calibrated"]').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="readiness-point"]')).toHaveLength(0)

    expect(wrapper.text().toLowerCase()).toContain('no accuracy data yet')
    expect(wrapper.findAll('[data-testid="accuracy-bar"]')).toHaveLength(0)
  })
})
