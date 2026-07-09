import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useProgressData } from '~/composables/useProgressData'
import ProgressPage from '~/pages/user-certifications/[id]/progress.vue'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

vi.mock('~/composables/useProgressData', () => ({ useProgressData: vi.fn() }))

vi.stubGlobal('useRoute', () => ({ params: { id: 'enr-1' } }))
vi.stubGlobal('navigateTo', vi.fn())

type ProgressData = ReturnType<typeof useProgressData>

function stubProgressData(overrides: Partial<Record<keyof ProgressData, unknown>> = {}) {
  vi.mocked(useProgressData).mockReturnValue({
    notFound: computed(() => (overrides.notFound as boolean | undefined) ?? false),
    certName: computed(
      () => (overrides.certName as string | undefined) ?? 'AWS Cloud Practitioner',
    ),
    certProvider: computed(() => (overrides.certProvider as string | undefined) ?? 'AWS'),
    domains: computed(() => (overrides.domains as unknown[]) ?? []),
    domainScores: computed(() => (overrides.domainScores as unknown[]) ?? []),
    trend: computed(
      () =>
        (overrides.trend as {
          points: { score: number; label: string }[]
          hasData: boolean
        }) ?? {
          points: [
            { score: 55, label: 'Jun 1' },
            { score: 62, label: 'Jun 10' },
            { score: 66, label: 'Jun 20' },
          ],
          hasData: true,
        },
    ),
    accuracySeries: computed(
      () =>
        (overrides.accuracySeries as Array<{
          sessionId: string
          accuracy: number
          label: string
        }>) ?? [{ sessionId: 's1', accuracy: 60, label: 'Jun 20' }],
    ),
    weeksToReady: computed(() =>
      overrides.weeksToReady !== undefined ? (overrides.weeksToReady as number | null) : 3,
    ),
    readiness: computed(
      () =>
        (overrides.readiness as { calibrated: boolean; score: number | null }) ?? {
          calibrated: true,
          score: 66,
          trajectory: { weeksToReady: 3 },
        },
    ),
    historyRows: computed(() => (overrides.historyRows as unknown[]) ?? []),
    sessions: computed(() => (overrides.sessions as unknown[]) ?? []),
    summariesMap: ref(new Map<string, SessionSummaryResponseDto>()),
    switcher: computed(
      () =>
        (overrides.switcher as Array<{ enrollmentId: string; certName: string }>) ?? [
          { enrollmentId: 'enr-1', certName: 'AWS Cloud Practitioner' },
        ],
    ),
    isLoading: computed(() => (overrides.isLoading as boolean | undefined) ?? false),
    isError: computed(() => (overrides.isError as boolean | undefined) ?? false),
  } as ProgressData)
}

function mountPage() {
  return mount(ProgressPage, {
    global: {
      stubs: {
        ReadinessTrend: { template: '<div data-testid="readiness-trend" />' },
        AccuracyBars: { template: '<div data-testid="accuracy-bars" />' },
        TrajectoryCallout: {
          template:
            '<div v-if="weeksToReady !== null" data-testid="trajectory-callout"><slot /></div>',
          props: ['weeksToReady'],
        },
        ProgressDomainRow: {
          template:
            '<div data-testid="progress-domain-row" :data-mastered="mastered"><slot /></div>',
          props: ['domain', 'score', 'status', 'hasData', 'delta', 'enrollmentId', 'mastered'],
        },
        ProgressSessionHistoryTable: {
          template: '<div data-testid="progress-session-history-table" />',
          props: ['rows'],
        },
        CertTabs: {
          template: '<div data-testid="cert-switcher"><slot /></div>',
          props: ['enrollments', 'activeEnrollmentId'],
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubProgressData()
})

describe('Progress page — header', () => {
  it('renders the progress-page testid', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="progress-page"]').exists()).toBe(true)
  })

  it('renders the cert name in progress-cert-name', () => {
    stubProgressData({ certName: 'AWS Certified Solutions Architect' })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="progress-cert-name"]').text()).toContain(
      'AWS Certified Solutions Architect',
    )
  })
})

describe('Progress page — not-found state', () => {
  it('renders progress-not-found and hides cert name when notFound', () => {
    stubProgressData({ notFound: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="progress-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-cert-name"]').exists()).toBe(false)
  })
})

describe('Progress page — charts', () => {
  it('renders readiness-trend and accuracy-bars', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="readiness-trend"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="accuracy-bars"]').exists()).toBe(true)
  })
})

describe('Progress page — trajectory callout', () => {
  it('renders trajectory-callout when weeksToReady is set', () => {
    stubProgressData({ weeksToReady: 3 })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(true)
  })

  it('does not render trajectory-callout when weeksToReady is null', () => {
    stubProgressData({
      weeksToReady: null,
      readiness: { calibrated: false, score: null, trajectory: null },
      trend: { points: [], hasData: false },
    })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="trajectory-callout"]').exists()).toBe(false)
  })
})

describe('Progress page — trajectory placement (5.1)', () => {
  it('renders the trajectory callout after the readiness chart and the stat cards', () => {
    const wrapper = mountPage()
    const html = wrapper.html()
    const trajectoryIndex = html.indexOf('trajectory-callout')
    const chartIndex = html.indexOf('readiness-trend')
    const statsIndex = html.indexOf('progress-stat-card')
    expect(trajectoryIndex).toBeGreaterThan(chartIndex)
    expect(trajectoryIndex).toBeGreaterThan(statsIndex)
  })
})

describe('Progress page — section labels, counters, and width (5.3/5.4)', () => {
  it('shows the "This month" section label above the activity stat cards', () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('This month')
  })

  it('labels the readiness section "Readiness over time" with a live session count', () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('Readiness over time')
    expect(wrapper.text()).toContain('3 sessions')
  })

  it('labels the session-history section with a live "N sessions total" count', () => {
    stubProgressData({
      historyRows: [
        { id: 'h1' },
        { id: 'h2' },
      ],
    })
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('Session history')
    expect(wrapper.text()).toContain('2 sessions total')
  })

  it('uses the standard (~1100px) content width, not the narrow max-w-[720px] column', () => {
    const wrapper = mountPage()
    const classes = wrapper.find('[data-testid="progress-page"]').classes()
    expect(classes).not.toContain('max-w-[720px]')
    expect(classes.join(' ')).toContain('max-w-[1100px]')
  })
})

describe('Progress page — domain rows', () => {
  it('renders one domain row per domainScores entry', () => {
    stubProgressData({
      domainScores: [
        { domain: 'Security', score: 41, status: 'poor', hasData: true, delta: null },
        { domain: 'Storage', score: 68, status: 'medium', hasData: true, delta: 5 },
      ],
    })
    const wrapper = mountPage()
    expect(wrapper.findAll('[data-testid="progress-domain-row"]')).toHaveLength(2)
  })
})

describe('Progress page — mastered domain grouping (6.2/6.3)', () => {
  it('renders every domain row, tagging mastered ones via the mastered prop', () => {
    stubProgressData({
      domainScores: [
        { domain: 'Security', score: 41, status: 'poor', hasData: true, delta: null, mastered: false },
        { domain: 'Storage', score: 88, status: 'good', hasData: true, delta: null, mastered: true },
      ],
    })
    const wrapper = mountPage()
    const rows = wrapper.findAll('[data-testid="progress-domain-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.attributes('data-mastered')).toBe('false')
    expect(rows[1]?.attributes('data-mastered')).toBe('true')
  })

  it('shows a "Mastered" divider group label when at least one domain is mastered', () => {
    stubProgressData({
      domainScores: [
        { domain: 'Security', score: 41, status: 'poor', hasData: true, delta: null, mastered: false },
        { domain: 'Storage', score: 88, status: 'good', hasData: true, delta: null, mastered: true },
      ],
    })
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('Mastered')
  })

  it('omits the "Mastered" divider when no domain is mastered', () => {
    stubProgressData({
      domainScores: [
        { domain: 'Security', score: 41, status: 'poor', hasData: true, delta: null, mastered: false },
      ],
    })
    const wrapper = mountPage()
    expect(wrapper.text()).not.toContain('Mastered')
  })
})

describe('Progress page — cert switcher', () => {
  it('renders the cert-switcher', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="cert-switcher"]').exists()).toBe(true)
  })
})

describe('Progress page — stat cards', () => {
  it('renders four stat cards from sessions and summariesMap', () => {
    stubProgressData({
      sessions: [
        {
          id: 's1',
          userCertificationId: 'uc-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 60,
          startedAt: '2026-06-01T09:00:00Z',
        },
        {
          id: 's2',
          userCertificationId: 'uc-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 60,
          startedAt: '2026-06-10T09:00:00Z',
        },
      ],
    })
    const wrapper = mountPage()
    expect(wrapper.findAll('[data-testid="progress-stat-card"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="progress-page"]').text()).toContain('Sessions')
    expect(wrapper.find('[data-testid="progress-page"]').text()).toContain('Questions answered')
    expect(wrapper.find('[data-testid="progress-page"]').text()).toContain('Study time')
    expect(wrapper.find('[data-testid="progress-page"]').text()).toContain('Current streak')
  })
})

describe('Progress page — current streak unit', () => {
  it('renders a singular "1 day" for a one-day streak', () => {
    stubProgressData({
      sessions: [
        {
          id: 's1',
          userCertificationId: 'uc-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 60,
          startedAt: '2026-06-01T09:00:00Z',
        },
      ],
    })
    const wrapper = mountPage()
    const streakCard = wrapper
      .findAll('[data-testid="progress-stat-card"]')
      .find((card) => card.text().includes('Current streak'))
    const unit = streakCard?.findAll('span').at(-1)
    expect(unit?.text()).toBe('day')
  })

  it('renders a plural "2 days" for a two-day streak', () => {
    stubProgressData({
      sessions: [
        {
          id: 's1',
          userCertificationId: 'uc-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 60,
          startedAt: '2026-06-01T09:00:00Z',
        },
        {
          id: 's2',
          userCertificationId: 'uc-1',
          kind: 'study',
          status: 'completed',
          durationMinutes: 60,
          startedAt: '2026-06-02T09:00:00Z',
        },
      ],
    })
    const wrapper = mountPage()
    const streakCard = wrapper
      .findAll('[data-testid="progress-stat-card"]')
      .find((card) => card.text().includes('Current streak'))
    const unit = streakCard?.findAll('span').at(-1)
    expect(unit?.text()).toBe('days')
  })
})
