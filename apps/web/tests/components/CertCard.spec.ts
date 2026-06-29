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
import { enrollmentReviewControllerStart } from '~~/src/api/enrollment-review/enrollment-review'
import type { WeakAreaResponseDto } from '~~/src/api/model'

vi.mock('~/composables/useCardReadiness', () => ({ useCardReadiness: vi.fn() }))
vi.mock('~/composables/useCardWeakAreas', () => ({ useCardWeakAreas: vi.fn() }))
vi.mock('~/composables/useCardRecentSessions', () => ({ useCardRecentSessions: vi.fn() }))
vi.mock('~/composables/useCardDueReviews', () => ({ useCardDueReviews: vi.fn() }))
vi.mock('~/composables/useQuickStartActions', () => ({ useQuickStartActions: vi.fn() }))
vi.mock('~~/src/api/enrollment-review/enrollment-review', () => ({
  enrollmentReviewControllerStart: vi.fn(),
}))

const mockPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: mockPush }))

const card: EnrollmentCard = {
  enrollmentId: 'enr-1',
  certificationId: 'cert-1',
  name: 'AWS Cloud Practitioner',
  provider: 'AWS',
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
    [{ id: 's1', date: '2026-06-20T00:00:00Z', label: 'Security', accuracy: 0.82 }],
    3,
  )
  stubDueReviews(0)
  stubQuickStartActions()
  vi.mocked(enrollmentReviewControllerStart).mockResolvedValue({
    data: undefined,
    status: 200,
    headers: new Headers(),
  })
})

describe('CertCard title + readiness', () => {
  it('renders the certification name and provider', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="cert-title"]').text()).toContain('AWS Cloud Practitioner')
    expect(wrapper.find('[data-testid="cert-title"]').text()).toContain('AWS')
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

describe('CertCard weak areas', () => {
  it('renders up to three weak areas with status-coloured scores', () => {
    stubWeakAreas([
      weakArea({ domain: 'Billing', score: 48 }),
      weakArea({ domain: 'Security', score: 61 }),
      weakArea({ domain: 'Pricing', score: 88 }),
    ])
    const wrapper = mountCard()
    const rows = wrapper.findAll('[data-testid="weak-area-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Billing')
    expect(rows[0]!.text()).toContain('48%')
    expect(rows[0]!.find('[data-testid="weak-area-score"]').classes()).toContain(
      'text-readion-status-poor',
    )
    expect(rows[1]!.find('[data-testid="weak-area-score"]').classes()).toContain(
      'text-readion-status-warning',
    )
    expect(rows[2]!.find('[data-testid="weak-area-score"]').classes()).toContain(
      'text-readion-status-good',
    )
  })

  it('shows a "No data yet" placeholder when there are no weak areas', () => {
    stubWeakAreas([])
    const wrapper = mountCard()
    expect(wrapper.findAll('[data-testid="weak-area-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="weak-areas-panel"]').text()).toContain('No data yet')
  })
})

describe('CertCard recent sessions', () => {
  it('renders a completed session as domain label plus accuracy', () => {
    stubRecentSessions(
      [{ id: 's1', date: '2026-06-20T00:00:00Z', label: 'Security', accuracy: 0.82 }],
      3,
    )
    const wrapper = mountCard()
    const rows = wrapper.findAll('[data-testid="recent-session-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Security')
    expect(rows[0]!.text()).toContain('82%')
  })

  it('falls back to date plus focus area with no accuracy when a session has no summary', () => {
    stubRecentSessions(
      [{ id: 's2', date: '2026-06-19T00:00:00Z', label: 'Storage', accuracy: null }],
      null,
    )
    const wrapper = mountCard()
    const row = wrapper.find('[data-testid="recent-session-row"]')
    expect(row.text()).toContain('Storage')
    expect(row.text()).toContain('2026-06-19')
    expect(row.text()).not.toContain('%')
  })

  it('shows a "No sessions yet" placeholder when there are no recent sessions', () => {
    stubRecentSessions([], null)
    const wrapper = mountCard()
    expect(wrapper.findAll('[data-testid="recent-session-row"]')).toHaveLength(0)
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

  it('navigates into the review queue entry without pre-calling start on activation', async () => {
    stubDueReviews(12)
    const wrapper = mountCard()
    await wrapper.find('[data-testid="review-start-btn"]').trigger('click')
    await flushPromises()
    expect(enrollmentReviewControllerStart).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/user-certifications/enr-1/review')
  })
})
