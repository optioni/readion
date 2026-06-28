import { describe, expect, it } from 'vitest'
import { resolveOnboardingRoute } from '~/composables/resolveOnboardingRoute'

describe('resolveOnboardingRoute', () => {
  it('routes to the dashboard when there is at least one active enrollment', () => {
    expect(
      resolveOnboardingRoute({
        certs: [{ id: 'cert-1' }],
        role: 'user',
        enrollments: [{ id: 'enr-1' }],
      }),
    ).toEqual({ kind: 'dashboard' })
  })

  it('routes to onboarding when there are no enrollments but at least one live cert', () => {
    expect(
      resolveOnboardingRoute({
        certs: [{ id: 'cert-1' }],
        role: 'user',
        enrollments: [],
      }),
    ).toEqual({ kind: 'onboarding' })
  })

  it('routes an admin to admin cert setup when there are no certs and no enrollments', () => {
    expect(
      resolveOnboardingRoute({
        certs: [],
        role: 'admin',
        enrollments: [],
      }),
    ).toEqual({ kind: 'admin-cert-setup' })
  })

  it('routes a non-admin to the no-certs empty state when there are no certs', () => {
    expect(
      resolveOnboardingRoute({
        certs: [],
        role: 'user',
        enrollments: [],
      }),
    ).toEqual({ kind: 'no-certs' })
  })

  it('prefers the dashboard branch even when there are no certs returned', () => {
    expect(
      resolveOnboardingRoute({
        certs: [],
        role: 'admin',
        enrollments: [{ id: 'enr-1' }],
      }),
    ).toEqual({ kind: 'dashboard' })
  })
})
