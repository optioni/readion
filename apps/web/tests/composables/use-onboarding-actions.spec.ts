import type { SessionDefaults } from '@readion/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { useOnboardingActions } from '~/composables/useOnboardingActions'
import {
  diagnosticControllerCreate,
  diagnosticControllerDismissOffer,
} from '~~/src/api/diagnostic/diagnostic'
import { userCertificationsControllerEnroll } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerUpdateMe } from '~~/src/api/users/users'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/user-certifications/user-certifications')
vi.mock('~~/src/api/diagnostic/diagnostic')

const sessionDefaults: SessionDefaults = {
  duration: 30,
  contentMix: 'balanced',
  difficulty: 'intermediate',
  focusArea: 'auto',
  learningStyle: 'weak-area-focus',
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const envelope = (data: unknown, status = 200) => ({
  data: { data, relationships: {} },
  status,
  headers: new Headers(),
})

let navigated: string | null

beforeEach(() => {
  navigated = null
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', (dest: string) => {
    navigated = dest
    return dest
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useOnboardingActions saveDefaultsAndEnroll', () => {
  it('PATCHes the profile defaults then POSTs the enrollment and returns the new id', async () => {
    vi.mocked(usersControllerUpdateMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'user-1' }) as any,
    )
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'enr-1' }, 201) as any,
    )

    const { result } = renderComposable(() => useOnboardingActions())
    const outcome = await result.saveDefaultsAndEnroll({
      certificationId: 'cert-1',
      sessionDefaults,
    })

    expect(usersControllerUpdateMe).toHaveBeenCalledWith({
      headers: jsonHeaders,
      body: JSON.stringify({ sessionDefaults }),
    })
    expect(userCertificationsControllerEnroll).toHaveBeenCalledWith({
      headers: jsonHeaders,
      body: JSON.stringify({ certificationId: 'cert-1', sessionDefaults }),
    })
    expect(
      vi.mocked(usersControllerUpdateMe).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(userCertificationsControllerEnroll).mock.invocationCallOrder[0])
    expect(outcome).toEqual({ ok: true, enrollmentId: 'enr-1' })
  })

  it('invalidates the dashboard and onboarding enrollment queries on success', async () => {
    vi.mocked(usersControllerUpdateMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'user-1' }) as any,
    )
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'enr-1' }, 201) as any,
    )

    const { result, queryClient } = renderComposable(() => useOnboardingActions())
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await result.saveDefaultsAndEnroll({ certificationId: 'cert-1', sessionDefaults })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardQueryKeys.enrollments() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: onboardingQueryKeys.enrollments() })
  })

  it('surfaces an error and does not advance when the enrollment POST fails', async () => {
    vi.mocked(usersControllerUpdateMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'user-1' }) as any,
    )
    const failure = new Error('Unprocessable Entity')
    vi.mocked(userCertificationsControllerEnroll).mockRejectedValue(failure)

    const { result, queryClient } = renderComposable(() => useOnboardingActions())
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const outcome = await result.saveDefaultsAndEnroll({
      certificationId: 'cert-1',
      sessionDefaults,
    })

    expect(outcome).toEqual({ ok: false, error: failure })
    expect(outcome).not.toHaveProperty('enrollmentId')
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(navigated).toBeNull()
  })
})

describe('useOnboardingActions takeDiagnostic', () => {
  it('creates the diagnostic attempt then navigates into the runner', async () => {
    vi.mocked(diagnosticControllerCreate).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope({ id: 'attempt-9', type: 'diagnostic' }, 201) as any,
    )

    const { result } = renderComposable(() => useOnboardingActions())
    await result.takeDiagnostic('enr-1')

    expect(diagnosticControllerCreate).toHaveBeenCalledWith('enr-1')
    expect(navigated).toBe('/mock-exams/attempt-9')
  })
})

describe('useOnboardingActions skipDiagnostic', () => {
  it('dismisses the offer then navigates to the dashboard', async () => {
    vi.mocked(diagnosticControllerDismissOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      envelope(undefined) as any,
    )

    const { result } = renderComposable(() => useOnboardingActions())
    await result.skipDiagnostic('enr-1')

    expect(diagnosticControllerDismissOffer).toHaveBeenCalledWith('enr-1')
    expect(navigated).toBe('/')
  })
})
