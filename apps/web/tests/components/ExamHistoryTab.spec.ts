import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import ExamHistoryTab from '~/components/ExamHistoryTab.vue'
import type { ExamHistoryRow } from '~/composables/useExamHistory'
import { useExamHistory } from '~/composables/useExamHistory'

vi.mock('~/composables/useExamHistory', () => ({ useExamHistory: vi.fn() }))

const examRow = (overrides: Partial<ExamHistoryRow> & { id: string }): ExamHistoryRow => ({
  id: overrides.id,
  date: overrides.date ?? '2026-06-20T09:00:00Z',
  type: overrides.type ?? 'mock',
  status: overrides.status ?? 'submitted',
  score: overrides.score ?? null,
  passed: overrides.passed ?? null,
})

function stubHistory(
  rows: ExamHistoryRow[],
  state?: {
    isLoading?: boolean
    isError?: boolean
    isFetching?: boolean
    retry?: () => Promise<void>
  },
) {
  vi.mocked(useExamHistory).mockReturnValue({
    rows: computed(() => rows),
    isLoading: ref(state?.isLoading ?? false),
    isError: ref(state?.isError ?? false),
    isFetching: ref(state?.isFetching ?? false),
    retry: state?.retry ?? vi.fn(async () => {}),
  })
}

function mountTab() {
  return mount(ExamHistoryTab, {
    props: { enrollmentId: 'enr-1' },
    global: {
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubHistory([
    examRow({ id: 'm1', type: 'mock', status: 'submitted', score: 78, passed: true }),
    examRow({ id: 'm2', type: 'diagnostic', status: 'in_progress', score: null, passed: null }),
  ])
})

describe('ExamHistoryTab list', () => {
  it('renders one row per attempt with date, type, status and score', () => {
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="exam-history-list"]').exists()).toBe(true)
    const rows = wrapper.findAll('[data-testid="exam-history-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('2026-06-20')
    expect(rows[0]!.text().toLowerCase()).toContain('mock')
    expect(rows[0]!.text().toLowerCase()).toContain('submitted')
    expect(rows[0]!.text()).toContain('78')
  })

  it('shows a passed indicator for a submitted attempt that passed', () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="exam-history-row"]')[0]!
    expect(row.text().toLowerCase()).toContain('pass')
  })

  it('shows a failed indicator for a submitted attempt that did not pass', () => {
    stubHistory([examRow({ id: 'm3', status: 'submitted', score: 40, passed: false })])
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="exam-history-row"]')[0]!
    expect(row.text().toLowerCase()).toContain('fail')
  })

  it('shows no pass or fail indicator when the attempt has no result yet', () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="exam-history-row"]')[1]!
    expect(row.text().toLowerCase()).not.toContain('pass')
    expect(row.text().toLowerCase()).not.toContain('fail')
  })

  it('links a submitted attempt into its mock-exam review route', () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="exam-history-row"]')[0]!
    expect(row.attributes('href')).toBe('/mock-exams/m1')
  })

  it('renders a non-submitted attempt without a link', () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="exam-history-row"]')[1]!
    expect(row.attributes('href')).toBeUndefined()
  })
})

describe('ExamHistoryTab empty state', () => {
  it('renders an empty state and no list when there are no attempts', () => {
    stubHistory([])
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="exam-history-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="exam-history-list"]').exists()).toBe(false)
  })

  it('renders an aria-busy loading region without flashing the empty state', () => {
    stubHistory([], { isLoading: true })
    const wrapper = mountTab()
    expect(wrapper.get('[data-testid="exam-history-async-region"]').attributes('aria-busy')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="exam-history-empty"]').exists()).toBe(false)
  })

  it('renders a section-local failure and retries once', async () => {
    const retry = vi.fn()
    stubHistory([], { isError: true, retry })
    const wrapper = mountTab()
    expect(wrapper.get('[role="alert"]').text()).toContain("Couldn't load exam history")
    await wrapper.get('[data-testid="readion-async-retry"]').trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
