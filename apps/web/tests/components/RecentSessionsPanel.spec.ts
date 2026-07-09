import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const mountPanel = (sessions: RecentSessionEntry[]) =>
  mount(RecentSessionsPanel, { props: { sessions } })

describe('RecentSessionsPanel', () => {
  it('renders a compact row with a friendly "when" label and the accuracy', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Study · IAM',
        accuracy: 0.8,
        durationMinutes: 20,
        delta: 3,
      },
    ])

    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows).toHaveLength(1)
    const text = rows[0]!.text()
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('Jun 20')
    expect(text).toContain('80%')
    expect(rows[0]?.find('[data-testid="recent-session-duration"]').text()).toContain('20m')
  })

  it('does not render the combined "Kind · focus" label (3.2)', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Study · IAM',
        accuracy: 0.8,
        durationMinutes: 20,
        delta: null,
      },
    ])
    expect(wrapper.text()).not.toContain('Study · IAM')
  })

  it('appends a "· Mock" suffix to the duration for a mock-kind session (3.2)', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Mock',
        accuracy: 0.71,
        durationMinutes: 107,
        delta: 8,
        kind: 'mock',
      },
    ])
    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.find('[data-testid="recent-session-duration"]').text()).toContain('107m · Mock')
  })

  it('omits the duration span for a row without a duration', () => {
    const wrapper = mountPanel([
      {
        id: 's2',
        date: '2026-06-19T00:00:00Z',
        label: 'Review · All domains',
        accuracy: null,
        durationMinutes: null,
        delta: null,
      },
    ])

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.find('[data-testid="recent-session-duration"]').exists()).toBe(false)
  })

  it('renders no accuracy figure for a row without a summary', () => {
    const wrapper = mountPanel([
      {
        id: 's2',
        date: '2026-06-19T00:00:00Z',
        label: 'Review · All domains',
        accuracy: null,
        durationMinutes: null,
        delta: null,
      },
    ])

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.text()).toContain('Jun 19')
    expect(row.text()).not.toContain('%')
    expect(row.find('[data-testid="recent-session-duration"]').exists()).toBe(false)
  })

  it('colours the accuracy figure by score band (3.2)', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: '',
        accuracy: 0.9,
        durationMinutes: 20,
        delta: null,
      },
    ])
    const accuracy = wrapper.find('[data-testid="recent-session-accuracy"]')
    expect(accuracy.classes()).toContain('text-readion-status-good')
  })

  it('shows a delta badge on every row that has a delta (3.1/3.2)', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: '',
        accuracy: 0.8,
        durationMinutes: 20,
        delta: 5,
      },
      {
        id: 's2',
        date: '2026-06-19T00:00:00Z',
        label: '',
        accuracy: 0.6,
        durationMinutes: 25,
        delta: -4,
      },
    ])

    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows[0]?.find('[data-testid="delta-badge"]').exists()).toBe(true)
    expect(rows[0]?.text()).toContain('5%')
    expect(rows[1]?.find('[data-testid="delta-badge"]').exists()).toBe(true)
    expect(rows[1]?.text()).toContain('4%')
  })

  it('omits the delta badge for a row with no delta', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: '',
        accuracy: 0.8,
        durationMinutes: 20,
        delta: null,
      },
    ])
    expect(wrapper.find('[data-testid="delta-badge"]').exists()).toBe(false)
  })

  it('separates rows with a hairline divider (3.2)', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: '',
        accuracy: 0.8,
        durationMinutes: 20,
        delta: null,
      },
      {
        id: 's2',
        date: '2026-06-19T00:00:00Z',
        label: '',
        accuracy: 0.6,
        durationMinutes: 25,
        delta: null,
      },
    ])
    expect(wrapper.findAll('[data-testid="recent-session-divider"]')).toHaveLength(1)
  })

  it('shows the empty-state placeholder when there are no sessions', () => {
    const wrapper = mountPanel([])
    expect(wrapper.findAll('[data-testid="recent-session-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No sessions yet')
  })
})
