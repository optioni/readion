import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import CertCard from '~/components/CertCard.vue'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import type { CardReadiness } from '~/composables/useCardReadiness'
import { useCardReadiness } from '~/composables/useCardReadiness'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'
import { useCardRecentSessions } from '~/composables/useCardRecentSessions'
import { useCardWeakAreas } from '~/composables/useCardWeakAreas'
import type { EnrollmentCard } from '~/composables/useEnrollments'
import { useQuickStartActions } from '~/composables/useQuickStartActions'
import type { WeakAreaResponseDto } from '~~/src/api/model'

vi.mock('~/composables/useCardReadiness', () => ({ useCardReadiness: vi.fn() }))
vi.mock('~/composables/useCardWeakAreas', () => ({ useCardWeakAreas: vi.fn() }))
vi.mock('~/composables/useCardRecentSessions', () => ({ useCardRecentSessions: vi.fn() }))
vi.mock('~/composables/useCardDueReviews', () => ({ useCardDueReviews: vi.fn() }))
vi.mock('~/composables/useQuickStartActions', () => ({ useQuickStartActions: vi.fn() }))

const mockPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockPush }))

const card: EnrollmentCard = {
  enrollmentId: 'enr-1',
  certificationId: 'cert-1',
  name: 'AWS Cloud Practitioner',
  provider: 'AWS',
  code: 'CLF-C02',
  readinessScore: 75,
  enrolledAt: '2026-06-01T00:00:00Z',
  status: 'active',
}

const weakArea = (overrides: Partial<WeakAreaResponseDto> & { domain: string; score: number }) => ({
  id: overrides.id ?? overrides.domain,
  domain: overrides.domain,
  score: overrides.score,
  accuracy: overrides.accuracy ?? 0,
  meanConfidence: overrides.meanConfidence ?? 0,
  responseCount: overrides.responseCount ?? 0,
})

function stubReadiness(value: CardReadiness) {
  vi.mocked(useCardReadiness).mockReturnValue({
    readiness: computed(() => value),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function stubWeakAreas(value: WeakAreaResponseDto[]) {
  vi.mocked(useCardWeakAreas).mockReturnValue({
    weakAreas: computed(() => value),
    isLoading: ref(false),
    isError: ref(false),
  })
}

function stubRecentSessions(sessions: RecentSessionEntry[], delta: number | null) {
  vi.mocked(useCardRecentSessions).mockReturnValue({
    sessions: computed(() => sessions),
    readinessDelta: computed(() => delta),
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

const startSession = vi.fn()
const startMockExam = vi.fn()

function stubQuickStartActions() {
  vi.mocked(useQuickStartActions).mockReturnValue({
    startSession,
    startMockExam,
    isStartingSession: ref(false),
    isStartingMockExam: ref(false),
  })
}

function mountCard(variant: 'hero' | 'standard' = 'hero') {
  return mount(CertCard, {
    props: { card, variant },
    global: {
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubReadiness({ calibrated: true, score: 75, trajectory: null })
  stubWeakAreas([
    weakArea({ domain: 'Billing', score: 48 }),
    weakArea({ domain: 'Security', score: 61 }),
    weakArea({ domain: 'Networking', score: 70 }),
  ])
  stubRecentSessions(
    [
      {
        id: 's1',
        date: '2026-06-20T00:00:00Z',
        label: 'Security',
        accuracy: 0.82,
        durationMinutes: 20,
      },
    ],
    3,
  )
  stubDueReviews(0)
  stubQuickStartActions()
})

describe('CertCard title + readiness', () => {
  it('renders the certification name and provider', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="cert-title"]').text()).toContain('AWS Cloud Practitioner')
    expect(wrapper.find('[data-testid="cert-title"]').text()).toContain('AWS')
  })

  it('renders the certification code pill beside the provider', () => {
    const wrapper = mountCard()
    const pill = wrapper.find('[data-testid="cert-code-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toBe('CLF-C02')
  })

  it('links the title to the enrollment detail page', () => {
    const wrapper = mountCard()
    const title = wrapper.find('[data-testid="cert-title"]')
    expect(title.attributes('href')).toBe('/user-certifications/enr-1')
  })

  it('shows the calibrated readiness percentage with its signed delta', () => {
    stubReadiness({ calibrated: true, score: 75, trajectory: null })
    stubRecentSessions([], 3)
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="card-readiness"]').text()).toContain('75% ready')
    expect(wrapper.find('[data-testid="readiness-delta"]').text()).toContain(
      '+3% since last session',
    )
  })

  it('omits the delta element when no prior session delta exists', () => {
    stubReadiness({ calibrated: true, score: 75, trajectory: null })
    stubRecentSessions([], null)
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="card-readiness"]').text()).toContain('75% ready')
    expect(wrapper.find('[data-testid="readiness-delta"]').exists()).toBe(false)
  })

  it('shows "not yet calibrated" and no delta when uncalibrated', () => {
    stubReadiness({ calibrated: false, score: null, trajectory: null })
    stubRecentSessions([], null)
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="card-readiness"]').text().toLowerCase()).toContain(
      'not yet calibrated',
    )
    expect(wrapper.find('[data-testid="readiness-delta"]').exists()).toBe(false)
  })
})

describe('CertCard flat hairline-divided sections', () => {
  it('separates the header, weak-areas, recent-sessions, and review sections with hairline dividers', () => {
    const wrapper = mountCard()
    expect(wrapper.findAll('[data-testid="card-section-divider"]').length).toBeGreaterThanOrEqual(2)
  })

  it('renders weak areas as a flat section, not a boxed CardPanel', () => {
    const wrapper = mountCard()
    const panel = wrapper.find('[data-testid="weak-areas-panel"]')
    expect(panel.classes()).not.toContain('bg-black/25')
  })
})

describe('CertCard weak areas', () => {
  it('renders up to three weak areas as status-coloured DomainBadge chips', () => {
    stubWeakAreas([
      weakArea({ domain: 'Billing', score: 48 }),
      weakArea({ domain: 'Security', score: 61 }),
      weakArea({ domain: 'Pricing', score: 88 }),
    ])
    // Standard variant: hero cards use the white/translucent DomainBadge treatment (matching
    // Dashboard.html) instead of the status-scale colours asserted here.
    const wrapper = mountCard('standard')
    const chips = wrapper.findAll('[data-testid="domain-badge"]')
    expect(chips).toHaveLength(3)
    expect(chips[0]?.text()).toContain('Billing')
    expect(chips[0]?.text()).toContain('48%')
    expect(chips[0]?.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-poor',
    )
    expect(chips[1]?.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-warning',
    )
    expect(chips[2]?.find('[data-testid="domain-badge-dot"]').classes()).toContain(
      'bg-readion-status-good',
    )
  })

  it('does not render weak areas as a bordered text list', () => {
    stubWeakAreas([weakArea({ domain: 'Billing', score: 48 })])
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="weak-area-row"]').exists()).toBe(false)
  })

  it('shows a "No data yet" placeholder when there are no weak areas', () => {
    stubWeakAreas([])
    const wrapper = mountCard()
    expect(wrapper.findAll('[data-testid="domain-badge"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="weak-areas-panel"]').text()).toContain('No data yet')
  })
})

describe('CertCard hero heading hierarchy', () => {
  it('renders the certification name as the primary heading with a NEEDS ATTENTION eyebrow on the hero card', () => {
    const wrapper = mountCard('hero')
    const heading = wrapper.find('h2')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toBe('AWS Cloud Practitioner')
    expect(wrapper.text()).toContain('NEEDS ATTENTION')
  })

  it('does not render the readiness percentage as the card heading', () => {
    const wrapper = mountCard('hero')
    const heading = wrapper.find('h2')
    expect(heading.text()).not.toContain('%')
  })

  it('does not show a NEEDS ATTENTION eyebrow on standard cards', () => {
    const wrapper = mountCard('standard')
    expect(wrapper.text()).not.toContain('NEEDS ATTENTION')
    expect(wrapper.find('h2').text()).toBe('AWS Cloud Practitioner')
  })
})

describe('CertCard action row placement', () => {
  it('renders the Mock Exam and Start Session actions in the bottom row, after the weak-areas and recent-sessions panels', () => {
    const wrapper = mountCard()
    const html = wrapper.html()
    const weakAreasIndex = html.indexOf('weak-areas-panel')
    const recentSessionsIndex = html.indexOf('recent-sessions-panel')
    const startBtnIndex = html.indexOf('start-session-btn')
    const mockBtnIndex = html.indexOf('mock-exam-btn')
    expect(startBtnIndex).toBeGreaterThan(weakAreasIndex)
    expect(startBtnIndex).toBeGreaterThan(recentSessionsIndex)
    expect(mockBtnIndex).toBeGreaterThan(recentSessionsIndex)
  })
})

describe('CertCard recent sessions — multi-column split', () => {
  it('renders one column per recent session with a friendly date and duration', () => {
    stubRecentSessions(
      [
        {
          id: 's1',
          date: '2026-06-20T00:00:00Z',
          label: 'Security',
          accuracy: 0.82,
          durationMinutes: 20,
        },
        {
          id: 's2',
          date: '2026-06-19T00:00:00Z',
          label: 'Storage',
          accuracy: null,
          durationMinutes: null,
        },
      ],
      3,
    )
    const wrapper = mountCard()
    const columns = wrapper.findAll('[data-testid="recent-session-column"]')
    expect(columns).toHaveLength(2)
    expect(columns[0]!.text()).toContain('Jun 20')
    expect(columns[0]!.text()).toContain('20m')
  })

  it('shows the readiness delta only on the most recent column', () => {
    stubRecentSessions(
      [
        {
          id: 's1',
          date: '2026-06-20T00:00:00Z',
          label: 'Security',
          accuracy: 0.82,
          durationMinutes: 20,
        },
        {
          id: 's2',
          date: '2026-06-19T00:00:00Z',
          label: 'Storage',
          accuracy: 0.6,
          durationMinutes: 25,
        },
      ],
      3,
    )
    const wrapper = mountCard()
    const columns = wrapper.findAll('[data-testid="recent-session-column"]')
    expect(columns[0]!.find('[data-testid="delta-badge"]').exists()).toBe(true)
    expect(columns[1]!.find('[data-testid="delta-badge"]').exists()).toBe(false)
  })

  it('shows a "No sessions yet" placeholder when there are no recent sessions', () => {
    stubRecentSessions([], null)
    const wrapper = mountCard()
    expect(wrapper.findAll('[data-testid="recent-session-column"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="recent-sessions-panel"]').text()).toContain(
      'No sessions yet',
    )
  })
})

describe('CertCard quick-start actions', () => {
  it('starts a session when the Start Session button is activated', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="start-session-btn"]').trigger('click')
    expect(startSession).toHaveBeenCalledTimes(1)
  })

  it('starts a mock exam when the Mock Exam button is activated', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="mock-exam-btn"]').trigger('click')
    expect(startMockExam).toHaveBeenCalledTimes(1)
  })
})

describe('CertCard variants', () => {
  it('marks the hero variant and uses the primary Start Session style', () => {
    const wrapper = mountCard('hero')
    expect(wrapper.find('[data-testid="cert-card"]').attributes('data-variant')).toBe('hero')
    expect(wrapper.find('[data-testid="start-session-btn"]').classes()).toContain('bg-white')
  })

  it('marks the standard variant and uses the muted Start Session style', () => {
    const wrapper = mountCard('standard')
    expect(wrapper.find('[data-testid="cert-card"]').attributes('data-variant')).toBe('standard')
    expect(wrapper.find('[data-testid="start-session-btn"]').classes()).not.toContain('bg-white')
  })
})

describe('CertCard due-review quick-start', () => {
  it('is hidden when there are no due reviews', () => {
    stubDueReviews(0)
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="review-quickstart"]').exists()).toBe(false)
  })

  it('shows the due-review count when reviews are due', () => {
    stubDueReviews(12)
    const wrapper = mountCard()
    const banner = wrapper.find('[data-testid="review-quickstart"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('12')
  })

  it('navigates into the review queue entry on activation', async () => {
    stubDueReviews(12)
    const wrapper = mountCard()
    await wrapper.find('[data-testid="review-start-btn"]').trigger('click')
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith({
      path: '/user-certifications/enr-1/review',
      query: { autostart: '1' },
    })
  })
})
