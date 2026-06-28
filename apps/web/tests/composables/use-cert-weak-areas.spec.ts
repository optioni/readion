import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/user-certifications/user-certifications')

const weakArea = (domain: string, score: number) => ({
  id: domain,
  domain,
  score,
  accuracy: 0,
  meanConfidence: 0,
  responseCount: 0,
})

const weakAreasEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

describe('useCertWeakAreas', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the full ranked weak-areas list without slicing', async () => {
    vi.mocked(userCertificationsControllerListWeakAreas).mockResolvedValue(
      weakAreasEnvelope([
        weakArea('Billing', 42),
        weakArea('Security', 55),
        weakArea('Networking', 61),
        weakArea('Storage', 70),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )

    const { result } = renderComposable(() => useCertWeakAreas('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(userCertificationsControllerListWeakAreas).toHaveBeenCalledWith('enr-1')
    expect(result.weakAreas.value).toHaveLength(4)
  })

  it('degrades to an empty list when the request fails', async () => {
    vi.mocked(userCertificationsControllerListWeakAreas).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCertWeakAreas('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.weakAreas.value).toEqual([])
  })
})
