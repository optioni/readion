import { afterEach, describe, expect, it, vi } from 'vitest'
import { readionFetch } from '~/api/mutator'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~/api/mutator')

const reviewEnvelope = (dueCount: number) => ({
  data: { items: [], meta: { dueCount, total: dueCount } },
  status: 200,
  headers: new Headers(),
})

describe('useCardDueReviews', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the due-review count from the review queue meta', async () => {
    vi.mocked(readionFetch).mockResolvedValue(reviewEnvelope(4))

    const { result } = renderComposable(() => useCardDueReviews('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(readionFetch).toHaveBeenCalledWith('/api/v1/user-certifications/enr-1/review')
    expect(result.dueCount.value).toBe(4)
  })

  it('exposes a zero count when there are no due reviews', async () => {
    vi.mocked(readionFetch).mockResolvedValue(reviewEnvelope(0))

    const { result } = renderComposable(() => useCardDueReviews('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.dueCount.value).toBe(0)
  })

  it('degrades to a zero count when the request fails', async () => {
    vi.mocked(readionFetch).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCardDueReviews('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.dueCount.value).toBe(0)
  })
})
