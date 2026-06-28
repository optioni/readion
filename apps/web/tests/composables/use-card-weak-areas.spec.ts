import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCardWeakAreas } from '~/composables/useCardWeakAreas'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/user-certifications/user-certifications')

const weakArea = (domain: string, score: number) => ({
  id: `wa-${domain}`,
  domain,
  score,
  accuracy: 0.5,
  meanConfidence: 0.5,
  responseCount: 10,
})

const okEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

describe('useCardWeakAreas', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the top 3 weakest domains in ranked order', async () => {
    vi.mocked(userCertificationsControllerListWeakAreas).mockResolvedValue(
      okEnvelope([
        weakArea('Networking', 0.2),
        weakArea('Security', 0.3),
        weakArea('Storage', 0.4),
        weakArea('Compute', 0.5),
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      ]) as any,
    )

    const { result } = renderComposable(() => useCardWeakAreas('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(userCertificationsControllerListWeakAreas).toHaveBeenCalledWith('enr-1')
    expect(result.weakAreas.value.map((area) => area.domain)).toEqual([
      'Networking',
      'Security',
      'Storage',
    ])
  })

  it('exposes an empty list when there are no weak areas', async () => {
    vi.mocked(userCertificationsControllerListWeakAreas).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { result } = renderComposable(() => useCardWeakAreas('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(result.weakAreas.value).toEqual([])
  })

  it('degrades to an empty list when the request fails', async () => {
    vi.mocked(userCertificationsControllerListWeakAreas).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCardWeakAreas('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.weakAreas.value).toEqual([])
  })
})
