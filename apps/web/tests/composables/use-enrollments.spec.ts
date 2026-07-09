import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEnrollments } from '~/composables/useEnrollments'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/user-certifications/user-certifications')
vi.mock('~~/src/api/certifications/certifications')

const enrollmentRow = {
  id: 'enr-1',
  certificationId: 'cert-1',
  status: 'active' as const,
  enrolledAt: '2026-06-01T00:00:00.000Z',
  sessionDefaults: {},
  readinessScore: 72,
}

const certificationRow = {
  id: 'cert-1',
  name: 'AWS Solutions Architect',
  provider: 'AWS',
  code: 'SAA-C03',
  domains: [],
  questionCount: 65,
  passingScore: 720,
  timeLimitMinutes: 130,
  state: 'ready',
}

const okEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

describe('useEnrollments', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches active enrollments and joins certification name/provider into per-card models', async () => {
    vi.mocked(userCertificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([enrollmentRow]) as any,
    )
    vi.mocked(certificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([certificationRow]) as any,
    )

    const { result } = renderComposable(() => useEnrollments())

    await vi.waitFor(() => {
      expect(result.cards.value).toHaveLength(1)
    })

    expect(userCertificationsControllerList).toHaveBeenCalledWith({ status: 'active' })
    expect(result.cards.value[0]).toEqual({
      enrollmentId: 'enr-1',
      certificationId: 'cert-1',
      name: 'AWS Solutions Architect',
      provider: 'AWS',
      code: 'SAA-C03',
      readinessScore: 72,
      enrolledAt: '2026-06-01T00:00:00.000Z',
      status: 'active',
    })
  })

  it('degrades certification name/provider to empty strings when no matching certification exists', async () => {
    vi.mocked(userCertificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([enrollmentRow]) as any,
    )
    vi.mocked(certificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { result } = renderComposable(() => useEnrollments())

    await vi.waitFor(() => {
      expect(result.cards.value).toHaveLength(1)
    })

    expect(result.cards.value[0]?.name).toBe('')
    expect(result.cards.value[0]?.provider).toBe('')
    expect(result.cards.value[0]?.code).toBe('')
  })

  it('exposes an error state and empty cards when the enrollment request fails', async () => {
    vi.mocked(userCertificationsControllerList).mockRejectedValue(new Error('boom'))
    vi.mocked(certificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([certificationRow]) as any,
    )

    const { result } = renderComposable(() => useEnrollments())

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.cards.value).toEqual([])
  })
})
