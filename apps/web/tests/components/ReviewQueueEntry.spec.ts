import type { ReviewItemResponse } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewQueueEntry from '~/components/ReviewQueueEntry.vue'

vi.mock('~/composables/runnerRoutes', () => ({
  sessionStartPath: (id: string) => `/user-certifications/${id}/session/start`,
}))

function dueItem(domain: string, id = domain): ReviewItemResponse {
  return {
    id,
    userCertificationId: 'enr-1',
    anchorChunkId: `chunk-${id}`,
    domain,
    box: 1,
    state: 'active',
    dueAt: '2026-06-29T00:00:00.000Z',
    lastReviewedAt: null,
  }
}

function mountEntry(options: {
  enrollmentId?: string
  items?: ReviewItemResponse[]
  dueCount?: number
}) {
  return mount(ReviewQueueEntry, {
    props: {
      enrollmentId: options.enrollmentId ?? 'enr-1',
      items: options.items ?? [],
      dueCount: options.dueCount ?? 0,
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

  it('displays the due count', () => {
    const wrapper = mountEntry({
      items: [
        dueItem('Secure Architectures', 'item-1'),
        dueItem('Secure Architectures', 'item-2'),
        dueItem('Resilient Architectures', 'item-3'),
      ],
      dueCount: 5,
    })
    expect(wrapper.find('[data-testid="review-due-count"]').text()).toContain('5')
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

  it('does not show the all-caught-up state', () => {
    const wrapper = mountEntry({
      items: [dueItem('Security', 'i1')],
      dueCount: 1,
    })
    expect(wrapper.find('[data-testid="review-all-caught-up"]').exists()).toBe(false)
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
