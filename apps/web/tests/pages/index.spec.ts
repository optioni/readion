import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { EnrollmentCard } from '~/composables/useEnrollments'
import { useEnrollments } from '~/composables/useEnrollments'
import IndexPage from '~/pages/index.vue'

vi.mock('~/composables/useEnrollments', () => ({ useEnrollments: vi.fn() }))

vi.mock('~/components/CertCard.vue', () => ({
  default: {
    name: 'CertCard',
    props: ['card', 'variant'],
    template: '<div data-testid="cert-card" :data-variant="variant" :data-name="card.name" />',
  },
}))

vi.mock('~/components/DiagnosticRePromptNudge.vue', () => ({
  default: {
    name: 'DiagnosticRePromptNudge',
    props: ['enrollmentId'],
    template: '<div data-testid="diagnostic-reprompt-stub" :data-enrollment-id="enrollmentId" />',
  },
}))

vi.mock('~/components/AddCertificationModal.vue', () => ({
  default: {
    name: 'AddCertificationModal',
    props: ['open'],
    emits: ['update:open'],
    template: '<div data-testid="add-cert-modal-stub" :data-open="open" />',
  },
}))

function card(overrides: Partial<EnrollmentCard> & { name: string }): EnrollmentCard {
  return {
    enrollmentId: overrides.enrollmentId ?? overrides.name,
    certificationId: overrides.certificationId ?? `${overrides.name}-cert`,
    name: overrides.name,
    provider: overrides.provider ?? 'AWS',
    code: overrides.code ?? 'CLF-C02',
    readinessScore: overrides.readinessScore ?? null,
    enrolledAt: overrides.enrolledAt ?? '2026-06-01T00:00:00Z',
    status: overrides.status ?? 'active',
  }
}

function stubEnrollments(options: {
  cards?: EnrollmentCard[]
  isLoading?: boolean
  isError?: boolean
  isFetching?: boolean
  retry?: () => Promise<void>
}) {
  const cards = options.cards ?? []
  vi.mocked(useEnrollments).mockReturnValue({
    cards: computed(() => cards),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    isFetching: computed(() => options.isFetching ?? false),
    retry: options.retry ?? vi.fn(async () => {}),
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

describe('Dashboard content width', () => {
  it('uses the standard (~1100px) content width, not the narrow max-w-[720px] column', () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    const classes = wrapper.find('section').classes()
    expect(classes).not.toContain('max-w-[720px]')
    expect(classes.join(' ')).toContain('max-w-[1100px]')
  })
})

describe('Dashboard list', () => {
  it('renders the shared PageHeader with the DASHBOARD eyebrow and "Your certifications" h1', () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    expect(wrapper.find('h1').text()).toBe('Your certifications')
    expect(wrapper.text()).toContain('DASHBOARD')
  })

  it('renders a right-aligned "N active" indicator matching the enrollment count', () => {
    stubEnrollments({
      cards: [card({ name: 'A', readinessScore: 50 }), card({ name: 'B', readinessScore: 60 })],
    })
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('2 active')
  })

  it('renders one card per active enrollment plus the add-certification entry', () => {
    stubEnrollments({
      cards: [card({ name: 'A', readinessScore: 75 }), card({ name: 'B', readinessScore: 42 })],
    })
    const wrapper = mountPage()
    expect(renderedCards(wrapper)).toHaveLength(2)
    expect(wrapper.find('[data-testid="add-cert"]').exists()).toBe(true)
  })

  it('mounts a self-hiding re-prompt nudge per active enrollment', () => {
    stubEnrollments({
      cards: [
        card({ name: 'A', enrollmentId: 'enr-a', readinessScore: 75 }),
        card({ name: 'B', enrollmentId: 'enr-b', readinessScore: 42 }),
      ],
    })
    const wrapper = mountPage()
    const nudges = wrapper.findAll('[data-testid="diagnostic-reprompt-stub"]')
    expect(nudges).toHaveLength(2)
    expect(nudges.map((n) => n.attributes('data-enrollment-id'))).toEqual(['enr-a', 'enr-b'])
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
  it('shows an aria-busy card skeleton without flashing the empty state', () => {
    stubEnrollments({ cards: [], isLoading: true })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-certifications"]').attributes('aria-busy')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="cert-card-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(false)
  })

  it('preserves loaded cards while a background refresh is pending', () => {
    stubEnrollments({
      cards: [card({ name: 'A', readinessScore: 50 })],
      isFetching: true,
    })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="dashboard-certifications"]').attributes('aria-busy')).toBe(
      'true',
    )
    expect(renderedCards(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('Refreshing certifications…')
  })

  it('shows the exact failure message and retries without rendering the empty state', async () => {
    const retry = vi.fn()
    stubEnrollments({ cards: [], isError: true, retry })
    const wrapper = mountPage()
    expect(wrapper.text()).toContain("Couldn't load your certifications")
    expect(wrapper.find('[data-testid="dashboard-empty"]').exists()).toBe(false)
    await wrapper.find('[data-testid="readion-async-retry"]').trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('Dashboard add-certification entry', () => {
  it('shows the "Track another exam alongside this one" subtitle', () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="add-cert"]').text()).toContain(
      'Track another exam alongside this one',
    )
  })

  it('opens the add-certification seam when the entry is activated', async () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    await wrapper.find('[data-testid="add-cert"]').trigger('click')
    expect(wrapper.find('[data-testid="add-cert"]').attributes('aria-expanded')).toBe('true')
  })

  it('opens the add-certification modal when the entry is activated', async () => {
    stubEnrollments({ cards: [card({ name: 'A', readinessScore: 50 })] })
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="add-cert-modal-stub"]').attributes('data-open')).toBe(
      'false',
    )
    await wrapper.find('[data-testid="add-cert"]').trigger('click')
    expect(wrapper.find('[data-testid="add-cert-modal-stub"]').attributes('data-open')).toBe('true')
  })
})
