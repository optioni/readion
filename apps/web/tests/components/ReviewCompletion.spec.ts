import type { SessionSummaryResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReviewCompletion from '~/components/ReviewCompletion.vue'

vi.mock('~/components/SessionSummaryBody.vue', () => ({
  default: {
    props: ['summary', 'drillNoMisses', 'hideAskAgent'],
    template: `
      <div data-testid="summary-body-stub" :data-accuracy="summary.accuracy" :data-nomiss="drillNoMisses">
        <div data-testid="summary-accuracy">{{ Math.round(summary.accuracy * 100) }}%</div>
        <button data-testid="drill-button" @click="$emit('drill')">Drill</button>
        <button data-testid="summary-back-button" @click="$emit('back')">Back</button>
      </div>
    `,
    emits: ['drill', 'back', 'ask-agent'],
  },
}))

function baseSummary(overrides: Partial<SessionSummaryResponse> = {}): SessionSummaryResponse {
  return {
    questionsAnswered: 5,
    accuracy: 0.8,
    domains: [{ domain: 'Secure Architectures', accuracy: 0.8 }],
    weakAreaDeltas: [{ domain: 'Secure Architectures', delta: 5 }],
    readiness: { before: 60, after: 64, delta: 4 },
    strongestQuestion: null,
    weakestQuestion: null,
    nextFocus: null,
    ...overrides,
  }
}

function mountCompletion(
  props: { summary?: SessionSummaryResponse; drillNoMisses?: boolean } = {},
) {
  return mount(ReviewCompletion, {
    props: {
      summary: props.summary ?? baseSummary(),
      drillNoMisses: props.drillNoMisses ?? false,
    },
  })
}

describe('ReviewCompletion container', () => {
  it('renders the session-summary-page container', () => {
    const wrapper = mountCompletion()
    expect(wrapper.find('[data-testid="session-summary-page"]').exists()).toBe(true)
  })

  it('renders the SessionSummaryBody with the given summary', () => {
    const wrapper = mountCompletion({ summary: baseSummary({ accuracy: 0.75 }) })
    expect(wrapper.find('[data-testid="summary-accuracy"]').text()).toContain('75%')
  })

  it('passes drillNoMisses to SessionSummaryBody', () => {
    const wrapper = mountCompletion({ drillNoMisses: true })
    const body = wrapper.find('[data-testid="summary-body-stub"]')
    expect(body.attributes('data-nomiss')).toBe('true')
  })
})

describe('ReviewCompletion event forwarding', () => {
  it('emits drill when SessionSummaryBody emits drill', async () => {
    const wrapper = mountCompletion()
    await wrapper.find('[data-testid="drill-button"]').trigger('click')
    expect(wrapper.emitted('drill')).toHaveLength(1)
  })

  it('emits back when SessionSummaryBody emits back', async () => {
    const wrapper = mountCompletion()
    await wrapper.find('[data-testid="summary-back-button"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
