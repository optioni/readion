import type { SessionSummaryResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionSummaryBody from '~/components/SessionSummaryBody.vue'

function baseSummary(overrides: Partial<SessionSummaryResponse> = {}): SessionSummaryResponse {
  return {
    questionsAnswered: 12,
    accuracy: 0.67,
    domains: [
      { domain: 'IAM & Security', accuracy: 0.8 },
      { domain: 'Networking', accuracy: 0.57 },
    ],
    weakAreaDeltas: [
      { domain: 'IAM & Security', delta: 7 },
      { domain: 'Networking', delta: -2 },
    ],
    readiness: { before: 72, after: 75, delta: 3 },
    strongestQuestion: { responseId: 'resp-strong', question: 'Strongest question text?' },
    weakestQuestion: { responseId: 'resp-weak', question: 'Weakest question text?' },
    nextFocus: { domain: 'Networking & Content Delivery' },
    ...overrides,
  }
}

function mountBody(
  props: {
    summary?: SessionSummaryResponse
    timeLabel?: string | null
    drillNoMisses?: boolean
  } = {},
) {
  return mount(SessionSummaryBody, {
    props: {
      summary: props.summary ?? baseSummary(),
      timeLabel: props.timeLabel ?? null,
      drillNoMisses: props.drillNoMisses ?? false,
    },
  })
}

describe('SessionSummaryBody accuracy', () => {
  it('renders accuracy as a percentage with a correct/total subtitle', () => {
    const wrapper = mountBody()
    const accuracy = wrapper.find('[data-testid="summary-accuracy"]')
    expect(accuracy.exists()).toBe(true)
    expect(accuracy.text()).toContain('67%')
    expect(accuracy.text()).toContain('8/12')
  })

  it('renders the derived time label when provided', () => {
    const wrapper = mountBody({ timeLabel: '20m 34s' })
    expect(wrapper.text()).toContain('20m 34s')
  })
})

describe('SessionSummaryBody domains', () => {
  it('renders per-domain accuracy with the joined weak-area delta badge', () => {
    const wrapper = mountBody()
    const domains = wrapper.find('[data-testid="summary-domains"]')
    expect(domains.exists()).toBe(true)
    expect(domains.text()).toContain('IAM & Security')
    expect(domains.text()).toContain('80%')
    expect(domains.text()).toContain('Networking')
    expect(domains.text()).toContain('57%')
    const badges = domains.findAll('[data-testid="delta-badge"]')
    expect(badges).toHaveLength(2)
    expect(badges[0]?.text()).toContain('7')
    expect(badges[1]?.text()).toContain('2')
  })
})

describe('SessionSummaryBody weak-area movement', () => {
  it('renders a delta badge per weak-area movement', () => {
    const wrapper = mountBody()
    const deltas = wrapper.findAll('[data-testid="weak-area-delta"]')
    expect(deltas).toHaveLength(2)
    expect(deltas[0]?.text()).toContain('IAM & Security')
    expect(deltas[0]?.text()).toContain('7')
    expect(deltas[1]?.text()).toContain('2')
  })
})

describe('SessionSummaryBody readiness', () => {
  it('renders readiness before to after with the delta when calibrated', () => {
    const wrapper = mountBody()
    const readiness = wrapper.find('[data-testid="summary-readiness"]')
    expect(readiness.exists()).toBe(true)
    expect(readiness.text()).toContain('72%')
    expect(readiness.text()).toContain('75%')
    expect(readiness.text()).toContain('+3%')
  })

  it('renders a calibration message when readiness is not yet calibrated', () => {
    const wrapper = mountBody({
      summary: baseSummary({ readiness: { before: null, after: null, delta: null } }),
    })
    const readiness = wrapper.find('[data-testid="summary-readiness"]')
    expect(readiness.text().toLowerCase()).toContain('calibrat')
    expect(readiness.text()).not.toContain('%')
  })
})

describe('SessionSummaryBody strongest and weakest', () => {
  it('renders the strongest question text and an ask-agent action keyed on responseId', async () => {
    const wrapper = mountBody()
    const strongest = wrapper.find('[data-testid="summary-strongest"]')
    expect(strongest.exists()).toBe(true)
    expect(strongest.text()).toContain('Strongest question text?')

    await strongest.find('[data-testid="ask-agent-button"]').trigger('click')
    expect(wrapper.emitted('ask-agent')?.[0]).toEqual(['resp-strong'])
  })

  it('renders the weakest question text and an ask-agent action keyed on responseId', async () => {
    const wrapper = mountBody()
    const weakest = wrapper.find('[data-testid="summary-weakest"]')
    expect(weakest.exists()).toBe(true)
    expect(weakest.text()).toContain('Weakest question text?')

    await weakest.find('[data-testid="ask-agent-button"]').trigger('click')
    expect(wrapper.emitted('ask-agent')?.[0]).toEqual(['resp-weak'])
  })

  it('omits a highlight card when the question is null', () => {
    const wrapper = mountBody({
      summary: baseSummary({ strongestQuestion: null, weakestQuestion: null }),
    })
    expect(wrapper.find('[data-testid="summary-strongest"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="summary-weakest"]').exists()).toBe(false)
  })
})

describe('SessionSummaryBody next focus', () => {
  it('renders the suggested next focus domain', () => {
    const wrapper = mountBody()
    const next = wrapper.find('[data-testid="summary-next-focus"]')
    expect(next.exists()).toBe(true)
    expect(next.text()).toContain('Networking & Content Delivery')
  })

  it('omits the next-focus card when there is no suggestion', () => {
    const wrapper = mountBody({ summary: baseSummary({ nextFocus: null }) })
    expect(wrapper.find('[data-testid="summary-next-focus"]').exists()).toBe(false)
  })
})

describe('SessionSummaryBody actions', () => {
  it('emits drill when the drill button is clicked', async () => {
    const wrapper = mountBody()
    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    expect(wrapper.emitted('drill')).toHaveLength(1)
  })

  it('emits back when the back-to-dashboard button is clicked', async () => {
    const wrapper = mountBody()
    await wrapper.find('[data-testid="summary-back-button"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('shows the empty-state message instead of drilling when there are no misses', () => {
    const wrapper = mountBody({ drillNoMisses: true })
    expect(wrapper.find('[data-testid="drill-empty"]').exists()).toBe(true)
  })
})
