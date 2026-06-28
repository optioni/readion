import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, type Ref, ref } from 'vue'
import SessionsTab from '~/components/SessionsTab.vue'
import type { SessionHistoryRow } from '~/composables/useSessionsHistory'
import { useSessionsHistory } from '~/composables/useSessionsHistory'

vi.mock('~/composables/useSessionsHistory', () => ({ useSessionsHistory: vi.fn() }))

const historyRow = (overrides: Partial<SessionHistoryRow> & { id: string }): SessionHistoryRow => ({
  id: overrides.id,
  date: overrides.date ?? '2026-06-20T00:00:00Z',
  kind: overrides.kind ?? 'study',
  focusArea: overrides.focusArea ?? 'Networking',
  durationMinutes: overrides.durationMinutes ?? 30,
  status: overrides.status ?? 'completed',
  accuracy: overrides.accuracy ?? null,
})

function stubHistory(rows: SessionHistoryRow[], meta?: { total?: number }) {
  vi.mocked(useSessionsHistory).mockReturnValue({
    rows: computed(() => rows),
    total: computed(() => meta?.total ?? rows.length),
    page: ref(1),
    limit: ref(10),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function mountTab() {
  return mount(SessionsTab, {
    props: { certificationId: 'cert-1' },
    global: {
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubHistory([
    historyRow({
      id: 's1',
      kind: 'study',
      focusArea: 'Networking',
      durationMinutes: 30,
      status: 'completed',
      accuracy: 0.82,
    }),
    historyRow({
      id: 's2',
      kind: 'review',
      focusArea: 'Storage',
      durationMinutes: 15,
      status: 'abandoned',
      accuracy: null,
    }),
  ])
})

describe('SessionsTab table', () => {
  it('renders one row per session with date, kind, focus area, duration and status', () => {
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="sessions-history-table"]').exists()).toBe(true)
    const rows = wrapper.findAll('[data-testid="session-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('2026-06-20')
    expect(rows[0]!.text().toLowerCase()).toContain('study')
    expect(rows[0]!.text()).toContain('Networking')
    expect(rows[0]!.text()).toContain('30')
    expect(rows[0]!.text().toLowerCase()).toContain('completed')
  })

  it('shows accuracy for a completed row that has a summary', () => {
    const wrapper = mountTab()
    const rows = wrapper.findAll('[data-testid="session-row"]')
    expect(rows[0]!.text()).toContain('82%')
  })

  it('shows no accuracy figure for a row without a summary', () => {
    const wrapper = mountTab()
    const rows = wrapper.findAll('[data-testid="session-row"]')
    expect(rows[1]!.text()).not.toContain('%')
  })

  it('links each row to its session run route', () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="session-row"]')[0]!
    expect(row.attributes('href')).toBe('/sessions/s1')
  })
})

describe('SessionsTab type filter', () => {
  it('shows both kinds under the All filter', () => {
    const wrapper = mountTab()
    expect(wrapper.findAll('[data-testid="session-row"]')).toHaveLength(2)
  })

  it('narrows to study rows when Study is selected', async () => {
    const wrapper = mountTab()
    await wrapper.find('[data-testid="session-filter-study"]').trigger('click')
    const rows = wrapper.findAll('[data-testid="session-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Networking')
  })

  it('narrows to review rows when Review is selected', async () => {
    const wrapper = mountTab()
    await wrapper.find('[data-testid="session-filter-review"]').trigger('click')
    const rows = wrapper.findAll('[data-testid="session-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Storage')
  })

  it('restores both kinds when All is selected again', async () => {
    const wrapper = mountTab()
    await wrapper.find('[data-testid="session-filter-study"]').trigger('click')
    await wrapper.find('[data-testid="session-filter-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="session-row"]')).toHaveLength(2)
  })

  it('marks the active filter via aria-pressed', async () => {
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="session-filter-all"]').attributes('aria-pressed')).toBe(
      'true',
    )
    await wrapper.find('[data-testid="session-filter-study"]').trigger('click')
    expect(wrapper.find('[data-testid="session-filter-study"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="session-filter-all"]').attributes('aria-pressed')).toBe(
      'false',
    )
  })

  it('exposes filter buttons by accessible name', () => {
    const wrapper = mountTab()
    const names = wrapper.findAll('button').map((b) => b.text())
    expect(names.some((n) => /^all$/i.test(n))).toBe(true)
    expect(names.some((n) => /^study$/i.test(n))).toBe(true)
    expect(names.some((n) => /^review$/i.test(n))).toBe(true)
  })
})

describe('SessionsTab empty state', () => {
  it('renders an empty state and no table when there are no sessions', () => {
    stubHistory([])
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="sessions-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sessions-history-table"]').exists()).toBe(false)
  })
})

describe('SessionsTab pagination', () => {
  function stubPaged(page: Ref<number>, limit: number, total: number) {
    vi.mocked(useSessionsHistory).mockReturnValue({
      rows: computed(() => [historyRow({ id: 's1' })]),
      total: computed(() => total),
      page,
      limit: ref(limit),
      isLoading: ref(false),
      isError: ref(false),
    })
  }

  it('renders a pager and advances the page ref on next when there is more than one page', async () => {
    const page = ref(1)
    stubPaged(page, 5, 8)
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="sessions-pagination"]').exists()).toBe(true)
    await wrapper.find('[data-testid="sessions-page-next"]').trigger('click')
    expect(page.value).toBe(2)
  })

  it('hides the pager when every session fits on one page', () => {
    stubPaged(ref(1), 5, 3)
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="sessions-pagination"]').exists()).toBe(false)
  })

  it('disables prev on the first page and next on the last page', () => {
    stubPaged(ref(1), 5, 8)
    const onFirst = mountTab()
    expect(onFirst.find('[data-testid="sessions-page-prev"]').attributes('disabled')).toBeDefined()
    expect(
      onFirst.find('[data-testid="sessions-page-next"]').attributes('disabled'),
    ).toBeUndefined()

    stubPaged(ref(2), 5, 8)
    const onLast = mountTab()
    expect(onLast.find('[data-testid="sessions-page-prev"]').attributes('disabled')).toBeUndefined()
    expect(onLast.find('[data-testid="sessions-page-next"]').attributes('disabled')).toBeDefined()
  })

  it('decrements the page ref on prev', async () => {
    const page = ref(2)
    stubPaged(page, 5, 8)
    const wrapper = mountTab()
    await wrapper.find('[data-testid="sessions-page-prev"]').trigger('click')
    expect(page.value).toBe(1)
  })
})
