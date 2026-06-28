export const onboardingQueryKeys = {
  certifications: () => ['onboarding', 'certifications'] as const,
  profile: () => ['onboarding', 'profile'] as const,
  enrollments: () => ['onboarding', 'enrollments', 'active'] as const,
  diagnosticOffer: (enrollmentId: string) =>
    ['onboarding', 'diagnostic-offer', enrollmentId] as const,
}
