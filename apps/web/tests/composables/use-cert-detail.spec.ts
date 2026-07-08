import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { useCertDetail } from '~/composables/useCertDetail'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerDetail } from '~~/src/api/user-certifications/user-certifications'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/user-certifications/user-certifications')
vi.mock('~~/src/api/certifications/certifications')

const enrollmentEnvelope = (certificationId: string) => ({
  data: {
    data: {
      id: 'enr-1',
      certificationId,
      status: 'active',
      enrolledAt: '2026-06-01T00:00:00Z',
      sessionDefaults: {},
      readinessScore: 72,
    },
    relationships: { weakAreas: { href: '/x', data: [] } },
  },
  status: 200,
  headers: new Headers(),
})

const certificationEnvelope = () => ({
  data: {
    data: {
      id: 'cert-1',
      name: 'AWS Cloud Practitioner',
      provider: 'AWS',
      code: 'CLF-C02',
      domains: [{ name: 'Billing', weight: 0.2 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      state: 'ready',
    },
    relationships: {},
  },
  status: 200,
  headers: new Headers(),
})

describe('useCertDetail', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the enrollment with weakAreas then the certification and exposes name + provider', async () => {
    vi.mocked(userCertificationsControllerDetail).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      enrollmentEnvelope('cert-1') as any,
    )
    vi.mocked(certificationsControllerDetail).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      certificationEnvelope() as any,
    )

    const { result } = renderComposable(() => useCertDetail('enr-1'))

    await vi.waitFor(() => {
      expect(result.isLoading.value).toBe(false)
    })

    expect(userCertificationsControllerDetail).toHaveBeenCalledWith('enr-1', {
      include: 'weakAreas',
    })
    expect(certificationsControllerDetail).toHaveBeenCalledWith('cert-1')
    expect(result.name.value).toBe('AWS Cloud Practitioner')
    expect(result.provider.value).toBe('AWS')
    expect(result.code.value).toBe('CLF-C02')
    expect(result.certificationId.value).toBe('cert-1')
    expect(result.questionCount.value).toBe(65)
    expect(result.passingScore.value).toBe(700)
    expect(result.notFound.value).toBe(false)
    expect(result.isError.value).toBe(false)
  })

  it('exposes null passingScore before the certification has loaded', () => {
    vi.mocked(userCertificationsControllerDetail).mockImplementation(() => new Promise(() => {}))

    const { result } = renderComposable(() => useCertDetail('enr-1'))

    expect(result.passingScore.value).toBeNull()
  })

  it('flags notFound and skips the certification fetch when the enrollment lookup 404s', async () => {
    vi.mocked(userCertificationsControllerDetail).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Not Found', status: 404 }),
    )

    const { result } = renderComposable(() => useCertDetail('enr-x'))

    await vi.waitFor(() => {
      expect(result.notFound.value).toBe(true)
    })

    expect(certificationsControllerDetail).not.toHaveBeenCalled()
    expect(result.isError.value).toBe(false)
  })

  it('flags isError (not notFound) when the certification fetch fails', async () => {
    vi.mocked(userCertificationsControllerDetail).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      enrollmentEnvelope('cert-1') as any,
    )
    vi.mocked(certificationsControllerDetail).mockRejectedValue(new Error('boom'))

    const { result } = renderComposable(() => useCertDetail('enr-1'))

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.notFound.value).toBe(false)
  })
})
