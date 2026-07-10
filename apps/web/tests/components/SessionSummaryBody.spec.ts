import type { SessionSummaryResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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
    hideAskAgent?: boolean
    certCode?: string | null
    certName?: string | null
    completedAt?: string | null
    streakDays?: number | null
  } = {},
) {
  return mount(SessionSummaryBody, {
    props: {
      summary: props.summary ?? baseSummary(),
      timeLabel: props.timeLabel ?? null,
      drillNoMisses: props.drillNoMisses ?? false,
      hideAskAgent: props.hideAskAgent ?? false,
      certCode: props.certCode ?? null,
      certName: props.certName ?? null,
      completedAt: props.completedAt ?? null,
      streakDays: props.streakDays ?? null,
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

describe('SessionSummaryBody readiness-change bar', () => {
  it('renders a gradient fill and a directional arrow marker in the readiness strip', () => {
    const wrapper = mountBody()
    const strip = wrapper.find('[data-testid="summary-readiness-strip"]')

    expect(strip.find('[data-testid="readiness-bar-fill"]').exists()).toBe(true)
    expect(strip.find('[data-testid="readiness-bar-arrow"]').exists()).toBe(true)
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

describe('SessionSummaryBody ask-agent suppression', () => {
  it('shows the ask-agent affordances by default', () => {
    const wrapper = mountBody()
    expect(wrapper.findAll('[data-testid="ask-agent-button"]')).toHaveLength(2)
  })

  it('hides both ask-agent affordances when hideAskAgent is true', () => {
    const wrapper = mountBody({ hideAskAgent: true })
    expect(wrapper.findAll('[data-testid="ask-agent-button"]')).toHaveLength(0)
    // The strongest/weakest cards themselves still render — only the action is suppressed.
    expect(wrapper.find('[data-testid="summary-strongest"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-weakest"]').exists()).toBe(true)
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

describe('SessionSummaryBody page header', () => {
  it('renders the session-complete badge, title, cert name/duration, and a completion timestamp', () => {
    const wrapper = mountBody({
      certCode: 'SAA-C03',
      certName: 'Solutions Architect – Associate',
      timeLabel: '20m 34s',
      completedAt: '2026-06-29T00:20:34.000Z',
    })

    const header = wrapper.find('[data-testid="summary-header"]')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('Session complete')
    expect(header.text()).toContain('Study Session · SAA-C03')
    expect(header.text()).toContain('Solutions Architect – Associate')
    expect(header.text()).toContain('20m 34s')

    const timestamp = wrapper.find('[data-testid="summary-completed-at"]')
    expect(timestamp.exists()).toBe(true)
    expect(timestamp.text().length).toBeGreaterThan(0)
    expect(timestamp.text()).toContain('2026')
  })

  it('renders the page header even when no questions were answered (zero-state)', () => {
    const wrapper = mountBody({
      summary: baseSummary({ questionsAnswered: 0 }),
      certCode: 'SAA-C03',
      certName: 'Solutions Architect – Associate',
    })

    const header = wrapper.find('[data-testid="summary-header"]')
    expect(header.exists()).toBe(true)
    expect(header.text()).toContain('Session complete')
    expect(header.text()).toContain('Study Session · SAA-C03')
  })

  it('renders a relative "Today at h:mm A" timestamp right-aligned opposite the title block', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'))
    try {
      const wrapper = mountBody({
        certCode: 'SAA-C03',
        certName: 'Solutions Architect – Associate',
        completedAt: '2026-06-29T00:20:00.000Z',
      })

      const header = wrapper.find('[data-testid="summary-header"]')
      const timestamp = header.find('[data-testid="summary-completed-at"]')
      expect(timestamp.text()).toBe('Today at 12:20 AM')

      // Right-aligned opposite the title block: a top-level sibling of the title stack, not
      // nested inside it.
      const titleBlock = header.find('[data-testid="summary-header-title"]')
      expect(titleBlock.exists()).toBe(true)
      expect(titleBlock.find('[data-testid="summary-completed-at"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('SessionSummaryBody readiness-change strip', () => {
  it('renders the before -> after change with the signed delta badge, sourced from readiness', () => {
    const wrapper = mountBody()
    const strip = wrapper.find('[data-testid="summary-readiness-strip"]')
    expect(strip.exists()).toBe(true)
    expect(strip.text()).toContain('72%')
    expect(strip.text()).toContain('75%')
    expect(strip.text()).toContain('this session')

    const badge = strip.find('[data-testid="delta-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('3%')
  })

  it('shows the calibration message instead of a percentage change when readiness is uncalibrated', () => {
    const wrapper = mountBody({
      summary: baseSummary({ readiness: { before: null, after: null, delta: null } }),
    })
    const strip = wrapper.find('[data-testid="summary-readiness-strip"]')
    expect(strip.exists()).toBe(true)
    expect(strip.text().toLowerCase()).toContain('calibrat')
    expect(strip.text()).not.toContain('%')
  })

  it('is suppressed in the zero-state alongside the other data cards', () => {
    const wrapper = mountBody({ summary: baseSummary({ questionsAnswered: 0 }) })
    expect(wrapper.find('[data-testid="summary-readiness-strip"]').exists()).toBe(false)
  })
})

describe('SessionSummaryBody streak stat', () => {
  it('renders a Streak cell sourced from the streakDays prop when available', () => {
    const wrapper = mountBody({ streakDays: 4 })
    const streak = wrapper.find('[data-testid="summary-streak"]')
    expect(streak.exists()).toBe(true)
    expect(streak.text().toLowerCase()).toContain('streak')
    expect(streak.text()).toContain('4')
  })

  it('omits the Streak cell when streakDays is not provided', () => {
    const wrapper = mountBody()
    expect(wrapper.find('[data-testid="summary-streak"]').exists()).toBe(false)
  })

  it('omits the Streak cell when streakDays is explicitly null', () => {
    const wrapper = mountBody({ streakDays: null })
    expect(wrapper.find('[data-testid="summary-streak"]').exists()).toBe(false)
  })
})

describe('SessionSummaryBody zero-state', () => {
  it('renders an explicit empty state and suppresses the data cards when no questions were answered', () => {
    const wrapper = mountBody({ summary: baseSummary({ questionsAnswered: 0 }) })

    expect(wrapper.text().toLowerCase()).toContain('no questions answered this session')
    expect(wrapper.find('[data-testid="summary-accuracy"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="summary-readiness"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="summary-domains"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="weak-area-delta"]').exists()).toBe(false)
  })

  it('still renders the back-to-dashboard action when no questions were answered', async () => {
    const wrapper = mountBody({ summary: baseSummary({ questionsAnswered: 0 }) })

    const back = wrapper.find('[data-testid="summary-back-button"]')
    expect(back.exists()).toBe(true)
    await back.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})

describe('SessionSummaryBody full body (non-zero questionsAnswered)', () => {
  it('renders the accuracy, readiness, domains, and weak-area cards when questions were answered', () => {
    const wrapper = mountBody({ summary: baseSummary({ questionsAnswered: 12 }) })

    expect(wrapper.text().toLowerCase()).not.toContain('no questions answered this session')
    expect(wrapper.find('[data-testid="summary-accuracy"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-readiness"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="summary-domains"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weak-area-delta"]').exists()).toBe(true)
  })
})

describe('SessionSummaryBody actions', () => {
  it('emits drill when the drill button is clicked', async () => {
    const wrapper = mountBody()
    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    expect(wrapper.emitted('drill')).toHaveLength(1)
  })

  it('renders a leading play icon on the drill-my-misses CTA', () => {
    const wrapper = mountBody()
    const drillButton = wrapper.find('[data-testid="drill-button"]')
    expect(drillButton.find('[data-testid="drill-icon"]').exists()).toBe(true)
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
