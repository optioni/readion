export type OnboardingRole = 'user' | 'admin'

export type OnboardingDecision =
  | { kind: 'dashboard' }
  | { kind: 'onboarding' }
  | { kind: 'admin-cert-setup' }
  | { kind: 'no-certs' }

export function resolveOnboardingRoute(input: {
  certs: { id: string }[]
  role: OnboardingRole
  enrollments: { id: string }[]
}): OnboardingDecision {
  if (input.enrollments.length > 0) {
    return { kind: 'dashboard' }
  }

  if (input.certs.length === 0) {
    return input.role === 'admin' ? { kind: 'admin-cert-setup' } : { kind: 'no-certs' }
  }

  return { kind: 'onboarding' }
}
