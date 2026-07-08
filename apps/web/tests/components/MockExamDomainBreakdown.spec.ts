import type { MockExamDomainBreakdown as Breakdown } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MockExamDomainBreakdown from '~/components/MockExamDomainBreakdown.vue'

const BREAKDOWN: Breakdown = {
  'Resilient Architectures': { correct: 14, total: 18, accuracy: 0.78 },
  'Secure Architectures': { correct: 11, total: 16, accuracy: 0.69 },
  'High-Performing Architectures': { correct: 12, total: 16, accuracy: 0.75 },
  'Cost-Optimized Architectures': { correct: 9, total: 15, accuracy: 0.6 },
}

const DOMAIN_NAMES = Object.keys(BREAKDOWN)

function mountBreakdown(
  breakdown: Breakdown = BREAKDOWN,
  props: { passingScore?: number | null; domains?: { name: string; weight: number }[] | null } = {},
) {
  return mount(MockExamDomainBreakdown, { props: { breakdown, ...props } })
}

describe('MockExamDomainBreakdown', () => {
  it('renders the breakdown wrapper', () => {
    const wrapper = mountBreakdown()
    expect(wrapper.find('[data-testid="exam-domain-breakdown"]').exists()).toBe(true)
  })

  it('renders one row per domain with name, accuracy percent, and correct/total counts', () => {
    const wrapper = mountBreakdown()
    const rows = wrapper.findAll('[data-testid="exam-domain-row"]')
    expect(rows).toHaveLength(4)

    const resilient = rows[0]!
    expect(resilient.text()).toContain('Resilient Architectures')
    expect(resilient.text()).toContain('78%')
    expect(resilient.text()).toContain('14/18')

    const cost = rows[3]!
    expect(cost.text()).toContain('Cost-Optimized Architectures')
    expect(cost.text()).toContain('60%')
    expect(cost.text()).toContain('9/15')
  })

  it('colours each accuracy via the shared status palette, not bespoke thresholds', () => {
    const wrapper = mountBreakdown()
    const rows = wrapper.findAll('[data-testid="exam-domain-row"]')
    // 78% → medium (65–80), 60% → warning (50–65) per statusColorForScore.
    expect(rows[0]!.html()).toContain('text-readion-status-medium')
    expect(rows[3]!.html()).toContain('text-readion-status-warning')
  })

  it('does not fabricate a per-domain weight or passing-threshold marker when no cert join is supplied', () => {
    const wrapper = mountBreakdown()
    expect(wrapper.find('[data-testid="exam-domain-weight"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="exam-below-threshold-note"]').exists()).toBe(false)
  })

  it('omits weight cells when domains is an empty array (cert unavailable)', () => {
    const wrapper = mountBreakdown(BREAKDOWN, { passingScore: null, domains: [] })
    expect(wrapper.find('[data-testid="exam-domain-weight"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(false)
  })

  it('renders the per-domain weight from the certification join', () => {
    const wrapper = mountBreakdown(BREAKDOWN, {
      passingScore: 72,
      domains: DOMAIN_NAMES.map((name) => ({ name, weight: 25 })),
    })
    const rows = wrapper.findAll('[data-testid="exam-domain-row"]')
    expect(rows[0]!.find('[data-testid="exam-domain-weight"]').text()).toContain('25%')
  })

  it('normalises a fractional (0-1) weight to a percentage', () => {
    const wrapper = mountBreakdown(BREAKDOWN, {
      passingScore: 72,
      domains: DOMAIN_NAMES.map((name) => ({ name, weight: 0.2 })),
    })
    const rows = wrapper.findAll('[data-testid="exam-domain-row"]')
    expect(rows[0]!.find('[data-testid="exam-domain-weight"]').text()).toContain('20%')
  })

  it('shows the threshold marker and below-threshold note only on rows under the passing score', () => {
    const wrapper = mountBreakdown(BREAKDOWN, {
      passingScore: 72,
      domains: DOMAIN_NAMES.map((name) => ({ name, weight: 25 })),
    })
    const rows = wrapper.findAll('[data-testid="exam-domain-row"]')

    const resilient = rows[0]! // 78%, above passing
    expect(resilient.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(false)
    expect(resilient.find('[data-testid="exam-below-threshold-note"]').exists()).toBe(false)

    const secure = rows[1]! // 69%, below passing
    expect(secure.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(true)
    expect(secure.find('[data-testid="exam-below-threshold-note"]').text()).toMatch(
      /below passing threshold/i,
    )

    const highPerforming = rows[2]! // 75%, above passing
    expect(highPerforming.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(false)
    expect(highPerforming.find('[data-testid="exam-below-threshold-note"]').exists()).toBe(false)

    const cost = rows[3]! // 60%, below passing
    expect(cost.find('[data-testid="exam-domain-threshold-marker"]').exists()).toBe(true)
    expect(cost.find('[data-testid="exam-below-threshold-note"]').text()).toMatch(
      /below passing threshold/i,
    )
  })
})
