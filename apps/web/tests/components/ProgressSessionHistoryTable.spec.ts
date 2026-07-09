import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProgressSessionHistoryTable from '~/components/ProgressSessionHistoryTable.vue'
import type { MergedHistoryRow } from '~/composables/useSessionHistoryMerge'

function makeRow(overrides: Partial<MergedHistoryRow> = {}): MergedHistoryRow {
  return {
    id: 's1',
    startedAt: '2026-06-20T09:00:00.000Z',
    kind: 'study',
    durationMinutes: 60,
    questionsAnswered: 8,
    accuracy: 75,
    readinessDelta: 7,
    status: 'completed',
    score: null,
    ...overrides,
  }
}

describe('ProgressSessionHistoryTable', () => {
  it('renders one progress-session-row per row', () => {
    const rows: MergedHistoryRow[] = [
      makeRow({ id: 's1', kind: 'study' }),
      makeRow({ id: 's2', kind: 'study' }),
      makeRow({ id: 's3', kind: 'study' }),
      makeRow({ id: 'm1', kind: 'mock', accuracy: null, score: 73 }),
    ]
    const wrapper = mount(ProgressSessionHistoryTable, { props: { rows } })
    expect(wrapper.findAll('[data-testid="progress-session-row"]')).toHaveLength(4)
  })

  it('shows a type pill with the session kind', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ kind: 'study' })] },
    })
    expect(wrapper.find('[data-testid="progress-session-row"]').text()).toContain('study')
  })

  it('shows the accuracy percentage for rows with accuracy data', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ accuracy: 75 })] },
    })
    expect(wrapper.find('[data-testid="progress-session-row"]').text()).toContain('75%')
  })

  it('renders "—" for rows without accuracy data', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ accuracy: null })] },
    })
    expect(wrapper.find('[data-testid="progress-session-row"]').text()).toContain('—')
  })

  it('renders a link to the session run path for study rows', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ id: 'session-abc', kind: 'study' })] },
    })
    const link = wrapper.find('[data-testid="progress-session-row"] a')
    expect(link.attributes('href')).toContain('session-abc')
  })

  it('renders a link to the mock exam run path for mock rows', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ id: 'mock-xyz', kind: 'mock', accuracy: null, score: 73 })] },
    })
    const link = wrapper.find('[data-testid="progress-session-row"] a')
    expect(link.attributes('href')).toContain('mock-xyz')
  })

  it('renders an empty state when there are no rows', () => {
    const wrapper = mount(ProgressSessionHistoryTable, { props: { rows: [] } })
    expect(wrapper.findAll('[data-testid="progress-session-row"]')).toHaveLength(0)
    expect(wrapper.text().toLowerCase()).toContain('no sessions')
  })
})

describe('ProgressSessionHistoryTable — full column set (W1)', () => {
  it('renders the questions-answered count when present', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ questionsAnswered: 8 })] },
    })
    expect(wrapper.find('[data-testid="progress-session-row"]').text()).toContain('8')
  })

  it('renders "—" for questions-answered when null', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ questionsAnswered: null })] },
    })
    const row = wrapper.find('[data-testid="session-questions"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toBe('—')
  })

  it('renders the duration in minutes when present', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ durationMinutes: 60 })] },
    })
    const cell = wrapper.find('[data-testid="session-duration"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toContain('60')
  })

  it('renders "—" for duration when null', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ durationMinutes: null })] },
    })
    const cell = wrapper.find('[data-testid="session-duration"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toBe('—')
  })

  it('renders a delta-badge for readinessDelta when present', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ readinessDelta: 7 })] },
    })
    const cell = wrapper.find('[data-testid="session-readiness-delta"]')
    expect(cell.exists()).toBe(true)
    expect(cell.find('[data-testid="delta-badge"]').exists()).toBe(true)
  })

  it('renders "—" for readiness-delta when null', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ readinessDelta: null })] },
    })
    const cell = wrapper.find('[data-testid="session-readiness-delta"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toBe('—')
  })
})

describe('ProgressSessionHistoryTable — column-header row (6.3)', () => {
  it('renders a visible column-header row with Date, Type, Duration, Questions, Accuracy, Readiness', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow()] },
    })
    const header = wrapper.find('[data-testid="progress-history-header"]')
    expect(header.exists()).toBe(true)
    for (const label of ['Date', 'Type', 'Duration', 'Questions', 'Accuracy', 'Readiness']) {
      expect(header.text()).toContain(label)
    }
  })

  it('does not render the header row when there are no rows', () => {
    const wrapper = mount(ProgressSessionHistoryTable, { props: { rows: [] } })
    expect(wrapper.find('[data-testid="progress-history-header"]').exists()).toBe(false)
  })

  it('formats the Date column in the friendly relative form, not a raw locale string', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ startedAt: '2026-06-01T09:00:00.000Z' })] },
    })
    const row = wrapper.find('[data-testid="progress-session-row"]')
    expect(row.text()).toContain('Jun 1')
    expect(row.text()).not.toContain('6/1/2026')
    expect(row.text()).not.toContain('1.6.2026')
  })

  it('shows the session start time-of-day as a secondary line beneath the date (5.3)', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ startedAt: '2026-06-01T15:42:00.000Z' })] },
    })
    const time = wrapper.find('[data-testid="session-time-of-day"]')
    expect(time.exists()).toBe(true)
    expect(time.text()).toBe('3:42 PM')
  })

  it('orders row columns with Date before the Type badge', () => {
    const wrapper = mount(ProgressSessionHistoryTable, {
      props: { rows: [makeRow({ startedAt: '2026-06-01T09:00:00.000Z', kind: 'study' })] },
    })
    const row = wrapper.find('[data-testid="progress-session-row"]')
    const text = row.text()
    const dateIndex = text.indexOf('Jun 1')
    const typeIndex = text.indexOf('study')
    expect(dateIndex).toBeGreaterThanOrEqual(0)
    expect(typeIndex).toBeGreaterThanOrEqual(0)
    expect(dateIndex).toBeLessThan(typeIndex)
  })
})
