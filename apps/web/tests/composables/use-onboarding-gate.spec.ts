import type { UserProfileResponse } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingGate } from '~/composables/useOnboardingGate'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/user-certifications/user-certifications')
vi.mock('~~/src/api/certifications/certifications')
vi.mock('~~/src/api/users/users')

const certificationRow = { id: 'cert-1' }
const enrollmentRow = { id: 'enr-1' }

const sessionDefaults: UserProfileResponse['sessionDefaults'] = {
  duration: 30,
  contentMix: 'balanced',
  difficulty: 'intermediate',
  focusArea: 'auto',
  learningStyle: 'weak-area-focus',
}

const profileFixture = (role: 'user' | 'admin'): UserProfileResponse => ({
  id: 'user-1',
  email: 'learner@example.com',
  role,
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  sessionDefaults,
})

const okEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length } },
  status: 200,
  headers: new Headers(),
})

const profileEnvelope = (role: 'user' | 'admin') => ({
  data: { data: profileFixture(role) },
  status: 200,
  headers: new Headers(),
})

const mockAll = (options: {
  role: 'user' | 'admin'
  certs: { id: string }[]
  enrollments: { id: string }[]
}) => {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  vi.mocked(usersControllerGetMe).mockResolvedValue(profileEnvelope(options.role) as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  vi.mocked(certificationsControllerList).mockResolvedValue(okEnvelope(options.certs) as any)
  vi.mocked(userCertificationsControllerList).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    okEnvelope(options.enrollments) as any,
  )
}

describe('useOnboardingGate', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resolves to a dashboard decision when an active enrollment exists', async () => {
    mockAll({ role: 'user', certs: [certificationRow], enrollments: [enrollmentRow] })

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.decision.value).toEqual({ kind: 'dashboard' })
    })
    expect(result.isLoading.value).toBe(false)
    expect(userCertificationsControllerList).toHaveBeenCalledWith({ status: 'active' })
  })

  it('resolves to an onboarding decision when there are live certs but no enrollments', async () => {
    mockAll({ role: 'user', certs: [certificationRow], enrollments: [] })

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.decision.value).toEqual({ kind: 'onboarding' })
    })
  })

  it('resolves an admin to the admin-cert-setup decision when there are no certs', async () => {
    mockAll({ role: 'admin', certs: [], enrollments: [] })

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.decision.value).toEqual({ kind: 'admin-cert-setup' })
    })
  })

  it('resolves a non-admin to the no-certs decision when there are no certs', async () => {
    mockAll({ role: 'user', certs: [], enrollments: [] })

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.decision.value).toEqual({ kind: 'no-certs' })
    })
  })

  it('exposes the profile session defaults', async () => {
    mockAll({ role: 'user', certs: [certificationRow], enrollments: [enrollmentRow] })

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.sessionDefaults.value).toEqual(sessionDefaults)
    })
  })

  it('does not resolve a decision while still loading', () => {
    vi.mocked(usersControllerGetMe).mockReturnValue(new Promise(() => {}))
    vi.mocked(certificationsControllerList).mockReturnValue(new Promise(() => {}))
    vi.mocked(userCertificationsControllerList).mockReturnValue(new Promise(() => {}))

    const { result } = renderComposable(() => useOnboardingGate())

    expect(result.isLoading.value).toBe(true)
    expect(result.decision.value).toBeNull()
  })

  it('exposes an error state and a null decision when a request fails', async () => {
    vi.mocked(usersControllerGetMe).mockRejectedValue(new Error('boom'))
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(certificationsControllerList).mockResolvedValue(okEnvelope([certificationRow]) as any)
    vi.mocked(userCertificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { result } = renderComposable(() => useOnboardingGate())

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })
    expect(result.decision.value).toBeNull()
  })
})
