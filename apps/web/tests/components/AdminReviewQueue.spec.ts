import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminReviewQueue from '~/components/admin/AdminReviewQueue.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminReviewQueue placeholder', () => {
  it('renders the page root and an honest "not yet available" placeholder', () => {
    const wrapper = mount(AdminReviewQueue)

    expect(wrapper.find('[data-testid="admin-review-queue-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-placeholder"]').text()).toMatch(
      /not yet available/i,
    )
  })

  it('fabricates no review items, verdicts or badge count', () => {
    const wrapper = mount(AdminReviewQueue)

    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="review-queue-verdict"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="review-queue-badge"]')).toHaveLength(0)
  })

  it('issues no HTTP request to any quarantine endpoint', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    mount(AdminReviewQueue)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
