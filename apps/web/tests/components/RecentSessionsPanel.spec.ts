import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const mountPanel = (sessions: RecentSessionEntry[], readinessDelta: number | null = null) =>
  mount(RecentSessionsPanel, { props: { sessions, readinessDelta } })

describe('RecentSessionsPanel', () => {
  it('renders a compact row with a friendly "when" label, the focus label, and the accuracy', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Study · IAM',
        accuracy: 0.8,
        durationMinutes: 20,
      },
    ])

    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows).toHaveLength(1)
    const text = rows[0]!.text()
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('Jun 20')
    expect(text).toContain('Study · IAM')
    expect(text).toContain('80%')
    expect(rows[0]!.find('[data-testid="recent-session-duration"]').text()).toContain('20m')
  })

  it('renders the session duration for a row that has one', () => {
    const wrapper = mountPanel([
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Study · IAM',
        accuracy: 0.8,
        durationMinutes: 45,
      },
    ])

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.find('[data-testid="recent-session-duration"]').text()).toContain('45m')
  })

  it('omits the duration span for a row without a duration', () => {
    const wrapper = mountPanel([
      {
        id: 's2',
        date: '2026-06-19T00:00:00Z',
        label: 'Review · All domains',
        accuracy: null,
        durationMinutes: null,
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
      },
    ])

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.text()).toContain('Jun 19')
    expect(row.text()).toContain('Review · All domains')
    expect(row.text()).not.toContain('%')
    expect(row.find('[data-testid="recent-session-duration"]').exists()).toBe(false)
  })

  it('renders the readiness delta on the most recent row only', () => {
    const wrapper = mountPanel(
      [
        {
          id: 's1',
          date: '2026-06-20T00:00:00Z',
          label: 'Study · IAM',
          accuracy: 0.8,
          durationMinutes: 20,
        },
        {
          id: 's2',
          date: '2026-06-19T00:00:00Z',
          label: 'Study · IAM',
          accuracy: 0.6,
          durationMinutes: 25,
        },
      ],
      5,
    )

    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows[0]!.find('[data-testid="delta-badge"]').exists()).toBe(true)
    expect(rows[0]!.text()).toContain('5%')
    expect(rows[1]!.find('[data-testid="delta-badge"]').exists()).toBe(false)
  })

  it('omits the delta badge when there is no readiness delta', () => {
    const wrapper = mountPanel(
      [
        {
          id: 's1',
          date: '2026-06-20T00:00:00Z',
          label: 'Study · IAM',
          accuracy: 0.8,
          durationMinutes: 20,
        },
      ],
      null,
    )
    expect(wrapper.find('[data-testid="delta-badge"]').exists()).toBe(false)
  })

  it('shows the empty-state placeholder when there are no sessions', () => {
    const wrapper = mountPanel([])
    expect(wrapper.findAll('[data-testid="recent-session-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No sessions yet')
  })
})
