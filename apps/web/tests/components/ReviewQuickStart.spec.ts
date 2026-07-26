import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerPush = vi.fn()
vi.stubGlobal('useRouter', () => ({ push: routerPush }))

import ReviewQuickStart from '~/components/ReviewQuickStart.vue'

const mountReview = (hero = false) =>
  mount(ReviewQuickStart, {
    props: { enrollmentId: 'enr-1', dueCount: 5, hero },
  })

beforeEach(() => {
  vi.clearAllMocks()
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

  it('shows Starting… and rejects duplicate activation while navigation is pending', async () => {
    let finishNavigation = () => {}
    routerPush.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve
        }),
    )
    const wrapper = mountReview()
    const start = wrapper.get('[data-testid="review-start-btn"]')

    await start.trigger('click')
    expect(start.attributes('aria-busy')).toBe('true')
    expect(start.text()).toContain('Starting…')
    expect(start.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)
    await start.trigger('click')
    expect(routerPush).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith({
      path: '/user-certifications/enr-1/review',
      query: { autostart: '1' },
    })

    finishNavigation()
    await flushPromises()
    expect(start.attributes('aria-busy')).toBeUndefined()
  })
})
