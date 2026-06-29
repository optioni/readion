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

function mountBreakdown(breakdown: Breakdown = BREAKDOWN) {
  return mount(MockExamDomainBreakdown, { props: { breakdown } })
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

  it('does not fabricate a per-domain weight or passing-threshold marker', () => {
    const wrapper = mountBreakdown()
    const text = wrapper.text().toLowerCase()
    expect(text).not.toContain('weight')
    expect(text).not.toContain('threshold')
  })
})
