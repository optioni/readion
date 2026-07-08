import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import OverviewTab from '~/components/OverviewTab.vue'
import type { SessionFocusAreaEntry } from '~/composables/lastStudiedAt'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import type { CardReadiness } from '~/composables/useCardReadiness'
import { useCardReadiness } from '~/composables/useCardReadiness'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { useOverviewSessions } from '~/composables/useOverviewSessions'
import type {
  CertificationDomainDto,
  SessionSummaryResponseDto,
  WeakAreaResponseDto,
} from '~~/src/api/model'

vi.mock('~/composables/useCardReadiness', () => ({ useCardReadiness: vi.fn() }))
vi.mock('~/composables/useCertWeakAreas', () => ({ useCertWeakAreas: vi.fn() }))
vi.mock('~/composables/useOverviewSessions', () => ({ useOverviewSessions: vi.fn() }))
vi.mock('~/composables/useCardDueReviews', () => ({ useCardDueReviews: vi.fn() }))

const domain = (name: string, weight = 0.25): CertificationDomainDto => ({ name, weight })

const weakArea = (overrides: { domain: string; score: number }): WeakAreaResponseDto => ({
  id: overrides.domain,
  domain: overrides.domain,
  score: overrides.score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

function stubReadiness(value: CardReadiness) {
  vi.mocked(useCardReadiness).mockReturnValue({
    readiness: computed(() => value),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function stubWeakAreas(value: WeakAreaResponseDto[]) {
  vi.mocked(useCertWeakAreas).mockReturnValue({
    weakAreas: computed(() => value),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function stubSessions(value: {
  sessions: RecentSessionEntry[]
  totalSessions: number
  nextFocusDomain: string | null
  questionsAnswered?: number
  accuracy?: number | null
  latestSummary?: SessionSummaryResponseDto | null
  sessionFocusAreas?: SessionFocusAreaEntry[]
}) {
  vi.mocked(useOverviewSessions).mockReturnValue({
    sessions: computed(() => value.sessions),
    totalSessions: computed(() => value.totalSessions),
    nextFocusDomain: computed(() => value.nextFocusDomain),
    questionsAnswered: computed(() => value.questionsAnswered ?? 0),
    accuracy: computed(() => value.accuracy ?? null),
    latestSummary: computed(() => value.latestSummary ?? null),
    sessionFocusAreas: computed(() => value.sessionFocusAreas ?? []),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function stubDueReviews(count: number) {
  vi.mocked(useCardDueReviews).mockReturnValue({
    dueCount: computed(() => count),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function mountTab(domains: CertificationDomainDto[]) {
  return mount(OverviewTab, {
    props: { enrollmentId: 'enr-1', certificationId: 'cert-1', domains },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubReadiness({ calibrated: true, score: 72, trajectory: null })
  stubWeakAreas([weakArea({ domain: 'Security', score: 48 })])
  stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
  stubDueReviews(0)
})

describe('OverviewTab stat row', () => {
  it('renders the calibrated readiness percentage', () => {
    stubReadiness({ calibrated: true, score: 72, trajectory: null })
    const row = mountTab([domain('Security')]).find('[data-testid="cert-detail-stat-row"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('72%')
  })

  it('renders "not yet calibrated" with no percentage when uncalibrated', () => {
    stubReadiness({ calibrated: false, score: null, trajectory: null })
    const row = mountTab([domain('Security')]).find('[data-testid="cert-detail-stat-row"]')
    expect(row.text().toLowerCase()).toContain('not yet calibrated')
    expect(row.text()).not.toContain('%')
  })

  it('shows the trajectory line only when a trajectory is present', () => {
    stubReadiness({ calibrated: true, score: 72, trajectory: { weeksToReady: 6 } })
    expect(mountTab([domain('Security')]).text()).toContain('exam-ready in ~6 weeks')

    stubReadiness({ calibrated: true, score: 72, trajectory: null })
    expect(mountTab([domain('Security')]).text()).not.toContain('exam-ready')
  })

  it('renders the questions-answered total and a status-coloured accuracy figure', () => {
    stubSessions({
      sessions: [],
      totalSessions: 3,
      nextFocusDomain: null,
      questionsAnswered: 44,
      accuracy: 0.7233,
    })
    const row = mountTab([domain('Security')]).find('[data-testid="cert-detail-stat-row"]')
    expect(row.text().toLowerCase()).toContain('questions')
    expect(row.text()).toContain('44')
    expect(row.text()).toContain('72%')
    const accuracy = row.findAll('span').find((span) => span.text() === '72%')
    expect(accuracy?.classes()).toContain('text-readion-status-medium')
  })

  it('shows a neutral placeholder of 0 questions and no accuracy when no summaries exist', () => {
    stubSessions({
      sessions: [],
      totalSessions: 0,
      nextFocusDomain: null,
      questionsAnswered: 0,
      accuracy: null,
    })
    const card = mountTab([domain('Security')]).find('[data-testid="cert-detail-questions-stat"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('0')
    expect(card.text()).not.toContain('%')
  })
})

describe('OverviewTab domain breakdown', () => {
  it('renders one status-coloured bar per certification domain', () => {
    stubWeakAreas([
      weakArea({ domain: 'Security', score: 48 }),
      weakArea({ domain: 'Storage', score: 90 }),
    ])
    const rows = mountTab([domain('Security'), domain('Storage')]).findAll(
      '[data-testid="domain-score-row"]',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Security')
    expect(rows[0]!.text()).toContain('48%')
    const securityFill = rows[0]!.find('[data-testid="domain-score-bar-fill"]')
    expect(securityFill.classes()).toContain('bg-readion-status-poor')
    expect(securityFill.attributes('style')).toContain('width: 48%')
    const storageFill = rows[1]!.find('[data-testid="domain-score-bar-fill"]')
    expect(storageFill.classes()).toContain('bg-readion-status-good')
    expect(storageFill.attributes('style')).toContain('width: 90%')
  })

  it('renders a neutral no-data state for a domain without a weak-area record', () => {
    stubWeakAreas([])
    const rows = mountTab([domain('Security')]).findAll('[data-testid="domain-score-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Security')
    expect(rows[0]!.text().toLowerCase()).toContain('no data yet')
    expect(rows[0]!.text()).not.toContain('%')
    const fill = rows[0]!.find('[data-testid="domain-score-bar-fill"]')
    if (fill.exists()) {
      expect(fill.attributes('class') ?? '').not.toContain('bg-readion-status-')
    }
  })
})

describe('OverviewTab suggested next focus', () => {
  it('uses the latest completed session nextFocus domain', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: 'Networking' })
    const panel = mountTab([domain('Security')]).find('[data-testid="suggested-next-focus"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Networking')
  })

  it('falls back to the lowest-scoring weak-area domain', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
    stubWeakAreas([
      weakArea({ domain: 'Security', score: 61 }),
      weakArea({ domain: 'Billing', score: 42 }),
    ])
    const panel = mountTab([domain('Security')]).find('[data-testid="suggested-next-focus"]')
    expect(panel.text()).toContain('Billing')
  })

  it('shows a neutral placeholder when neither source exists', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
    stubWeakAreas([])
    const panel = mountTab([domain('Security')]).find('[data-testid="suggested-next-focus"]')
    expect(panel.text().toLowerCase()).toContain('no suggestion yet')
  })
})

describe('OverviewTab weakest-domain side panel', () => {
  it('highlights the session next-focus domain alongside the domain breakdown', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: 'Networking' })
    const panel = mountTab([domain('Security')]).find('[data-testid="weakest-domain-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Networking')
  })

  it('surfaces the weakest weak-area domain together with its score on the fallback', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
    stubWeakAreas([
      weakArea({ domain: 'Security', score: 61 }),
      weakArea({ domain: 'Billing', score: 41 }),
    ])
    const panel = mountTab([domain('Security')]).find('[data-testid="weakest-domain-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Billing')
    expect(panel.text()).toContain('41%')
  })

  it('shows a neutral placeholder with no percent when there is no data', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
    stubWeakAreas([])
    const panel = mountTab([domain('Security')]).find('[data-testid="weakest-domain-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).not.toContain('%')
  })
})

describe('OverviewTab recent sessions', () => {
  it('renders recent session rows from the reused panel', () => {
    stubSessions({
      sessions: [{ id: 's1', date: '2026-06-20T00:00:00Z', label: 'Security', accuracy: 0.82 }],
      totalSessions: 1,
      nextFocusDomain: null,
    })
    const wrapper = mountTab([domain('Security')])
    expect(wrapper.find('[data-testid="recent-sessions-panel"]').exists()).toBe(true)
    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Security')
    expect(rows[0]!.text()).toContain('82%')
  })

  it('shows the "No sessions yet" placeholder when there are none', () => {
    stubSessions({ sessions: [], totalSessions: 0, nextFocusDomain: null })
    const wrapper = mountTab([domain('Security')])
    expect(wrapper.find('[data-testid="recent-sessions-panel"]').text()).toContain(
      'No sessions yet',
    )
  })
})
