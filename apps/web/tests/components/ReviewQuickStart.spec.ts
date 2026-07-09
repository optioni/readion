import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))

import ReviewQuickStart from '~/components/ReviewQuickStart.vue'

const mountReview = (hero = false) =>
  mount(ReviewQuickStart, {
    props: { enrollmentId: 'enr-1', dueCount: 5, hero },
  })

describe('ReviewQuickStart — sentence-case copy and play icon', () => {
  it('reads "5-min review", not "5-minute review"', () => {
    const wrapper = mountReview()
    expect(wrapper.find('[data-testid="review-start-btn"]').text()).toContain('5-min review')
    expect(wrapper.text()).not.toContain('5-minute review')
  })

  it('shows a leading play icon', () => {
    const wrapper = mountReview()
    expect(wrapper.find('[data-testid="review-play-icon"]').exists()).toBe(true)
  })
})
