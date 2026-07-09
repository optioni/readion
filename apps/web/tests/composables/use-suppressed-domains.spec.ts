import { afterEach, describe, expect, it, vi } from 'vitest'
import { readionFetch } from '~/api/mutator'
import { useSuppressedDomains } from '~/composables/useSuppressedDomains'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~/api/mutator')

const reviewEnvelope = (suppressedDomains: string[]) => ({
  data: { items: [], meta: { dueCount: 0, total: 0, suppressedDomains } },
  status: 200,
  headers: new Headers(),
})

describe('useSuppressedDomains', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the suppressed-domains list from the review queue meta', async () => {
    vi.mocked(readionFetch).mockResolvedValue(reviewEnvelope(['Security']))

    const { result } = renderComposable(() => useSuppressedDomains('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(readionFetch).toHaveBeenCalledWith('/api/v1/user-certifications/enr-1/review')
    expect(result.suppressedDomains.value).toEqual(['Security'])
  })

  it('exposes an empty array when no domains are suppressed', async () => {
    vi.mocked(readionFetch).mockResolvedValue(reviewEnvelope([]))

    const { result } = renderComposable(() => useSuppressedDomains('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.suppressedDomains.value).toEqual([])
  })

  it('degrades to an empty array when the request fails', async () => {
    vi.mocked(readionFetch).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useSuppressedDomains('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.suppressedDomains.value).toEqual([])
  })
})
