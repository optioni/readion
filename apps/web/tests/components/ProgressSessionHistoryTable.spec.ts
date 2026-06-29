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
