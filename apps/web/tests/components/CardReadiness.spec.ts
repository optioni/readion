import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CardReadiness from '~/components/CardReadiness.vue'
import type { ReadinessDisplay } from '~/composables/readinessFormat'

const display = (overrides: Partial<ReadinessDisplay> = {}): ReadinessDisplay => ({
  calibrated: true,
  label: null,
  percent: '75%',
  delta: null,
  score: 75,
  ...overrides,
})

describe('CardReadiness — ReadinessBar', () => {
  it('renders a readiness-bar track filled to the readiness percentage', () => {
    const wrapper = mount(CardReadiness, { props: { display: display({ score: 42 }) } })
    const fill = wrapper.find('[data-testid="readiness-bar-fill"]')
    expect(fill.exists()).toBe(true)
    expect(fill.attributes('style')).toContain('width: 42%')
  })

  it('uses the white-translucent hero treatment when hero is true', () => {
    const wrapper = mount(CardReadiness, {
      props: { display: display({ score: 60 }), hero: true },
    })
    const fill = wrapper.find('[data-testid="readiness-bar-fill"]')
    expect(fill.classes().join(' ')).toContain('white')
  })

  it('uses the readiness-band status color on standard cards', () => {
    const wrapper = mount(CardReadiness, {
      props: { display: display({ score: 90 }), hero: false },
    })
    const fill = wrapper.find('[data-testid="readiness-bar-fill"]')
    expect(fill.classes()).toContain('bg-readion-status-good')
  })

  it('renders an empty track (no fill) when readiness is not calibrated', () => {
    const wrapper = mount(CardReadiness, {
      props: { display: display({ calibrated: false, percent: null, score: null }) },
    })
    expect(wrapper.find('[data-testid="readiness-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="readiness-bar-fill"]').exists()).toBe(false)
  })
})
