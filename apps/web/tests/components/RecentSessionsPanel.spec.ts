import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const mountPanel = (sessions: RecentSessionEntry[]) =>
  mount(RecentSessionsPanel, { props: { sessions } })

describe('RecentSessionsPanel', () => {
  it('renders the formatted date, the typed/focus label and the real score for a scored row', () => {
    const wrapper = mountPanel([
      { id: 's1', date: '2026-06-20T00:00:00Z', label: 'Study · IAM', accuracy: 0.8 },
    ])

    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows).toHaveLength(1)
    const text = rows[0]!.text()
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('2026-06-20')
    expect(text).toContain('Study · IAM')
    expect(text).toContain('80%')
  })

  it('renders no accuracy figure for a row without a summary', () => {
    const wrapper = mountPanel([
      { id: 's2', date: '2026-06-19T00:00:00Z', label: 'Review · All domains', accuracy: null },
    ])

    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.text()).toContain('2026-06-19')
    expect(row.text()).toContain('Review · All domains')
    expect(row.text()).not.toContain('%')
  })

  it('shows the empty-state placeholder when there are no sessions', () => {
    const wrapper = mountPanel([])
    expect(wrapper.findAll('[data-testid="recent-session-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No sessions yet')
  })
})
