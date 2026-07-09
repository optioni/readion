import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DomainScoreBar from '~/components/DomainScoreBar.vue'
import type { StatusColorKey } from '~/composables/statusColor'

function mountBar(
  options: {
    domain?: string
    score?: number | null
    status?: StatusColorKey | null
    hasData?: boolean
    delta?: number | null
  } = {},
) {
  return mount(DomainScoreBar, {
    props: {
      domain: options.domain ?? 'Networking',
      score: options.score ?? 70,
      status: options.status ?? 'medium',
      hasData: options.hasData ?? true,
      delta: options.delta,
    },
  })
}

describe('DomainScoreBar — width and figure', () => {
  it('renders the root testid', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="domain-score-bar"]').exists()).toBe(true)
  })

  it('sets the fill width proportional to the score', () => {
    const wrapper = mountBar({ score: 70 })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').attributes('style')).toContain(
      'width: 70%',
    )
  })

  it('shows the domain label and the score figure', () => {
    const wrapper = mountBar({ domain: 'Networking', score: 70 })
    expect(wrapper.text()).toContain('Networking')
    expect(wrapper.text()).toContain('70%')
  })
})

describe('DomainScoreBar — status colour', () => {
  it.each([
    ['poor', 48],
    ['warning', 60],
    ['medium', 70],
    ['good', 90],
  ] as const)('applies the %s fill colour class', (status, score) => {
    const wrapper = mountBar({ status, score })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).toContain(
      `bg-readion-status-${status}`,
    )
  })
})

describe('DomainScoreBar — trend delta', () => {
  it('renders the domain-delta with the DeltaBadge for a positive delta', () => {
    const wrapper = mountBar({ delta: 7 })
    const delta = wrapper.find('[data-testid="domain-delta"]')
    expect(delta.exists()).toBe(true)
    expect(delta.text()).toContain('7')
  })

  it('does not render domain-delta when no delta is supplied', () => {
    const wrapper = mountBar({ delta: undefined })
    expect(wrapper.find('[data-testid="domain-delta"]').exists()).toBe(false)
  })

  it('does not render domain-delta when delta is null', () => {
    const wrapper = mountBar({ delta: null })
    expect(wrapper.find('[data-testid="domain-delta"]').exists()).toBe(false)
  })
})

describe('DomainScoreBar — accessibility', () => {
  it('exposes an accessible label with the domain and score', () => {
    const wrapper = mountBar({ domain: 'Networking', score: 70 })
    const label = wrapper.find('[aria-label]').attributes('aria-label')
    expect(label).toContain('Networking')
    expect(label).toContain('70%')
  })
})

describe('DomainScoreBar — mastered treatment (6.2)', () => {
  it('dims the bar fill when mastered', () => {
    const wrapper = mount(DomainScoreBar, {
      props: {
        domain: 'Networking',
        score: 70,
        status: 'medium',
        hasData: true,
        mastered: true,
      },
    })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).toContain('opacity-40')
  })

  it('does not dim the bar fill when not mastered', () => {
    const wrapper = mountBar({ score: 70 })
    expect(wrapper.find('[data-testid="domain-score-bar-fill"]').classes()).not.toContain(
      'opacity-40',
    )
  })
})

describe('DomainScoreBar — no data state', () => {
  it('renders a neutral no-data state without percentage, trend or status colour', () => {
    const wrapper = mountBar({ hasData: false, score: null, status: null, delta: undefined })
    expect(wrapper.text().toLowerCase()).toContain('no data yet')
    expect(wrapper.text()).not.toContain('%')
    expect(wrapper.find('[data-testid="domain-delta"]').exists()).toBe(false)
    const fill = wrapper.find('[data-testid="domain-score-bar-fill"]')
    if (fill.exists()) {
      expect(fill.attributes('class') ?? '').not.toContain('bg-readion-status-')
    }
  })
})
