import type { ReviewItemResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewQueueEntry from '~/components/ReviewQueueEntry.vue'

vi.mock('~/composables/runnerRoutes', () => ({
  sessionStartPath: (id: string) => `/user-certifications/${id}/session/start`,
}))

function dueItem(
  domain: string,
  id = domain,
  dueAt = '2026-06-29T00:00:00.000Z',
): ReviewItemResponse {
  return {
    id,
    userCertificationId: 'enr-1',
    anchorChunkId: `chunk-${id}`,
    domain,
    box: 1,
    state: 'active',
    dueAt,
    lastReviewedAt: null,
  }
}

function mountEntry(options: {
  enrollmentId?: string
  items?: ReviewItemResponse[]
  dueCount?: number
  starting?: boolean
}) {
  return mount(ReviewQueueEntry, {
    props: {
      enrollmentId: options.enrollmentId ?? 'enr-1',
      items: options.items ?? [],
      dueCount: options.dueCount ?? 0,
      starting: options.starting ?? false,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReviewQueueEntry — with due items', () => {
  it('shows the queue-entry container', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="review-queue-entry"]').exists()).toBe(true)
  })

  it('renders as a centered full-bleed hero, not a bordered card', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 1,
    })
    const entry = wrapper.find('[data-testid="review-queue-entry"]')
    expect(entry.classes()).toContain('items-center')
    expect(entry.classes()).toContain('justify-center')
    expect(entry.classes()).not.toContain('border')
  })

  it('renders the queue hero icon', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="review-queue-icon"]').exists()).toBe(true)
  })

  it('displays the due count', () => {
    const wrapper = mountEntry({
      items: [
        dueItem('Secure Architectures', 'item-1'),
        dueItem('Secure Architectures', 'item-2'),
        dueItem('Resilient Architectures', 'item-3'),
      ],
      dueCount: 5,
    })
    expect(wrapper.find('[data-testid="review-due-count"]').text()).toBe('5')
  })

  it('renders a plain due-count headline, not a count embedded in a circular badge', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 5,
    })
    const count = wrapper.find('[data-testid="review-due-count"]')
    expect(count.classes()).not.toContain('rounded-full')
    expect(wrapper.text()).toContain('items due for review')
  })

  it('shows the "Scheduled by spaced repetition" caption', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 1,
    })
    expect(wrapper.text()).toContain('Scheduled by spaced repetition · ~5 minutes')
  })

  it('does not render a "By domain" label before the domain chips', () => {
    const wrapper = mountEntry({
      items: [dueItem('Secure Architectures', 'item-1')],
      dueCount: 1,
    })
    expect(wrapper.text()).not.toContain('By domain')
  })

  it('shows per-domain breakdown listing every distinct domain', () => {
    const items = [
      dueItem('Secure Architectures', 'i1'),
      dueItem('Secure Architectures', 'i2'),
      dueItem('Resilient Architectures', 'i3'),
    ]
    const wrapper = mountEntry({ items, dueCount: 3 })
    const breakdown = wrapper.find('[data-testid="review-domain-breakdown"]')
    expect(breakdown.exists()).toBe(true)
    expect(breakdown.text()).toContain('Secure Architectures')
    expect(breakdown.text()).toContain('Resilient Architectures')
  })

  it('renders one chip per distinct domain with its label and count', () => {
    const items = [
      dueItem('Secure Architectures', 'i1'),
      dueItem('Secure Architectures', 'i2'),
      dueItem('Resilient Architectures', 'i3'),
    ]
    const wrapper = mountEntry({ items, dueCount: 3 })
    const chips = wrapper.findAll('[data-testid="review-domain-chip"]')
    expect(chips).toHaveLength(2)

    const secure = chips.find((chip) => chip.text().includes('Secure Architectures'))
    expect(secure).toBeDefined()
    expect(secure?.text()).toContain('2')

    const resilient = chips.find((chip) => chip.text().includes('Resilient Architectures'))
    expect(resilient).toBeDefined()
    expect(resilient?.text()).toContain('1')
  })

  it('renders the start-review button', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="start-review-button"]').exists()).toBe(true)
  })

  it('emits start when the start-review button is clicked', async () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('identifies start progress and disables the competing action', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
      starting: true,
    })
    const start = wrapper.get('[data-testid="start-review-button"]')
    expect(start.attributes('aria-busy')).toBe('true')
    expect(start.text()).toContain('Starting…')
    expect(wrapper.get('[data-testid="review-all-button"]').attributes('disabled')).toBeDefined()
  })

  it('does not show the all-caught-up state', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="review-all-caught-up"]').exists()).toBe(false)
  })

  it('does not render a separate self-grade entry button', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="start-self-grade-button"]').exists()).toBe(false)
  })

  it('does not emit start-self-grade', async () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    await wrapper.find('[data-testid="start-review-button"]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('start-self-grade')).toBeUndefined()
  })
})

describe('ReviewQueueEntry — secondary "Review all" action and overdue note', () => {
  const NOW = new Date('2026-07-01T09:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the review-all-button reading "Review all N" beside the primary CTA', () => {
    const wrapper = mountEntry({
      items: [
        dueItem('Secure Architectures', 'i1', '2026-06-29T00:00:00.000Z'),
        dueItem('Secure Architectures', 'i2', '2026-06-29T00:00:00.000Z'),
        dueItem('Secure Architectures', 'i3', '2026-07-01T00:00:00.000Z'),
        dueItem('Resilient Architectures', 'i4', '2026-07-01T00:00:00.000Z'),
        dueItem('Resilient Architectures', 'i5', '2026-06-29T00:00:00.000Z'),
      ],
      dueCount: 5,
    })
    const reviewAll = wrapper.find('[data-testid="review-all-button"]')
    expect(reviewAll.exists()).toBe(true)
    expect(reviewAll.text()).toContain('Review all 5')
  })

  it('emits start when review-all-button is clicked', async () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    await wrapper.find('[data-testid="review-all-button"]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('renders the overdue note with the count and max days when items are overdue', () => {
    const wrapper = mountEntry({
      items: [
        dueItem('Secure Architectures', 'i1', '2026-06-29T00:00:00.000Z'),
        dueItem('Secure Architectures', 'i2', '2026-06-29T00:00:00.000Z'),
        dueItem('Secure Architectures', 'i3', '2026-07-01T00:00:00.000Z'),
        dueItem('Resilient Architectures', 'i4', '2026-07-01T00:00:00.000Z'),
        dueItem('Resilient Architectures', 'i5', '2026-06-29T00:00:00.000Z'),
      ],
      dueCount: 5,
    })
    const note = wrapper.find('[data-testid="review-overdue-note"]')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('3 items overdue by 2 days')
  })

  it('does not render the overdue note when no item is overdue by a whole day', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1', '2026-07-01T00:00:00.000Z')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="review-overdue-note"]').exists()).toBe(false)
  })

  it('does not render review-all-button or review-overdue-note in the all-caught-up state', () => {
    const wrapper = mountEntry({ items: [], dueCount: 0 })
    expect(wrapper.find('[data-testid="review-all-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-overdue-note"]').exists()).toBe(false)
  })
})

describe('ReviewQueueEntry — all caught up (dueCount = 0)', () => {
  it('shows the all-caught-up empty state', () => {
    const wrapper = mountEntry({ items: [], dueCount: 0 })
    expect(wrapper.find('[data-testid="review-all-caught-up"]').exists()).toBe(true)
  })

  it('does not render the queue-entry container', () => {
    const wrapper = mountEntry({ items: [], dueCount: 0 })
    expect(wrapper.find('[data-testid="review-queue-entry"]').exists()).toBe(false)
  })

  it('does not render the start-review button', () => {
    const wrapper = mountEntry({ items: [], dueCount: 0 })
    expect(wrapper.find('[data-testid="start-review-button"]').exists()).toBe(false)
  })

  it('renders a link to start a normal study session', () => {
    const wrapper = mountEntry({ enrollmentId: 'enr-42', items: [], dueCount: 0 })
    const link = wrapper.find('[data-testid="review-study-instead-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('/user-certifications/enr-42/session/start')
  })
})
