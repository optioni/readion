import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { EnrollmentCard } from '~/composables/useEnrollments'
import { useEnrollments } from '~/composables/useEnrollments'
import IndexPage from '~/pages/index.vue'

vi.mock('~/composables/useEnrollments', () => ({ useEnrollments: vi.fn() }))

vi.mock('~/components/CertCard.vue', () => ({
  default: {
    name: 'CertCard',
    props: ['card', 'variant'],
    template:
      '<div data-testid="cert-card" :data-variant="variant" :data-name="card.name" />',
  },
}))

function card(overrides: Partial<EnrollmentCard> & { name: string }): EnrollmentCard {
  return {
    enrollmentId: overrides.enrollmentId ?? overrides.name,
    certificationId: overrides.certificationId ?? `${overrides.name}-cert`,
    name: overrides.name,
    provider: overrides.provider ?? 'AWS',
    readinessScore: overrides.readinessScore ?? null,
    enrolledAt: overrides.enrolledAt ?? '2026-06-01T00:00:00Z',
    status: overrides.status ?? 'active',
  }
}

function stubEnrollments(options: {
  cards?: EnrollmentCard[]
  isLoading?: boolean
  isError?: boolean
}) {
  const cards = options.cards ?? []
  vi.mocked(useEnrollments).mockReturnValue({
    cards: computed(() => cards),
    isLoading: ref(options.isLoading ?? false),
    isError: ref(options.isError ?? false),
  })
}

function mountPage() {
  return mount(IndexPage)
}

function renderedCards(wrapper: ReturnType<typeof mountPage>) {
  return wrapper.findAll('[data-testid="cert-card"]')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Dashboard list', () => {
  it('renders the "My certifications" section label', () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    expect(wrapper.text().toLowerCase()).toContain('my certifications')
  })

  it('renders one card per active enrollment plus the add-certification entry', () => {
    stubEnrollments({
      cards: [
        card({ name: 'A', readinessScore: 75 }),
        card({ name: 'B', readinessScore: 42 }),
      ],
    })
    const wrapper = mountPage()
    expect(renderedCards(wrapper)).toHaveLength(2)
    expect(wrapper.find('[data-testid="add-cert"]').exists()).toBe(true)
  })

  it('promotes the lowest-readiness cert to the hero and orders the rest ascending', () => {
    stubEnrollments({
      cards: [
        card({ name: 'High', readinessScore: 88 }),
        card({ name: 'Mid', readinessScore: 75 }),
        card({ name: 'Low', readinessScore: 42 }),
      ],
    })
    const wrapper = mountPage()
    const cards = renderedCards(wrapper)
    expect(cards.map((c) => c.attributes('data-name'))).toEqual(['Low', 'Mid', 'High'])
    expect(cards[0]!.attributes('data-variant')).toBe('hero')
    expect(cards[1]!.attributes('data-variant')).toBe('standard')
    expect(cards[2]!.attributes('data-variant')).toBe('standard')
  })

  it('orders uncalibrated certs after calibrated ones', () => {
    stubEnrollments({
      cards: [
        card({ name: 'Uncalibrated', readinessScore: null }),
        card({ name: 'Calibrated', readinessScore: 60 }),
      ],
    })
    const wrapper = mountPage()
    const cards = renderedCards(wrapper)
    expect(cards.map((c) => c.attributes('data-name'))).toEqual(['Calibrated', 'Uncalibrated'])
    expect(cards[0]!.attributes('data-variant')).toBe('hero')
    expect(cards[1]!.attributes('data-variant')).toBe('standard')
  })

  it('places the add-certification entry at the bottom of the list', () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    const list = wrapper.find('[data-testid="dashboard-list"]')
    const testids = list
      .findAll('[data-testid]')
      .map((el) => el.attributes('data-testid'))
      .filter((id) => id === 'cert-card' || id === 'add-cert')
    expect(testids[testids.length - 1]).toBe('add-cert')
  })
})

describe('Dashboard empty state', () => {
  it('renders the empty state with an add-certification CTA when there are no enrollments', () => {
    stubEnrollments({ cards: [] })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-cert-empty"]').exists()).toBe(true)
    expect(renderedCards(wrapper)).toHaveLength(0)
  })
})

describe('Dashboard loading and error degradation', () => {
  it('shows a loading state while enrollments are loading', () => {
    stubEnrollments({ cards: [], isLoading: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(false)
  })

  it('shows a non-fatal error message but still renders loaded cards', () => {
    stubEnrollments({
      cards: [card({ name: 'A', readinessScore: 50 })],
      isError: true,
    })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-error"]').exists()).toBe(true)
    expect(renderedCards(wrapper)).toHaveLength(1)
  })

  it('shows the error message instead of the empty state when loading fails with no cards', () => {
    stubEnrollments({ cards: [], isError: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(false)
  })
})

describe('Dashboard add-certification entry', () => {
  it('opens the add-certification seam when the entry is activated', async () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    await wrapper.find('[data-testid="add-cert"]').trigger('click')
    expect(wrapper.find('[data-testid="add-cert"]').attributes('aria-expanded')).toBe('true')
  })
})
