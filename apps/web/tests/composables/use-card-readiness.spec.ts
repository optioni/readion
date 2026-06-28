import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCardReadiness } from '~/composables/useCardReadiness'
import { readinessControllerRead } from '~~/src/api/readiness/readiness'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/readiness/readiness')

const readinessEnvelope = <T>(payload: T) => ({
  data: { data: payload },
  status: 200,
  headers: new Headers(),
})

describe('useCardReadiness', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('maps calibrated/score/trajectory for the enrollment', async () => {
    vi.mocked(readinessControllerRead).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      readinessEnvelope({ calibrated: true, score: 81, trajectory: { weeksToReady: 3 } }) as any,
    )

    const { result } = renderComposable(() => useCardReadiness('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(readinessControllerRead).toHaveBeenCalledWith('enr-1')
    expect(result.readiness.value).toEqual({
      calibrated: true,
      score: 81,
      trajectory: { weeksToReady: 3 },
    })
  })

  it('degrades to a placeholder readiness when the request fails', async () => {
    vi.mocked(readinessControllerRead).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCardReadiness('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.readiness.value).toEqual({
      calibrated: false,
      score: null,
      trajectory: null,
    })
  })
})
