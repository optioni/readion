import { describe, expect, it } from 'vitest'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'

describe('onboarding query keys', () => {
  it('builds the certifications key', () => {
    expect(onboardingQueryKeys.certifications()).toEqual(['onboarding', 'certifications'])
  })

  it('builds the profile key', () => {
    expect(onboardingQueryKeys.profile()).toEqual(['onboarding', 'profile'])
  })

  it('builds the enrollments key', () => {
    expect(onboardingQueryKeys.enrollments()).toEqual(['onboarding', 'enrollments', 'active'])
  })

  it('builds the diagnostic offer key from an enrollment id', () => {
    expect(onboardingQueryKeys.diagnosticOffer('enr-1')).toEqual([
      'onboarding',
      'diagnostic-offer',
      'enr-1',
    ])
  })

  it('namespaces keys disjointly from dashboardQueryKeys', () => {
    expect(onboardingQueryKeys.enrollments()[0]).not.toBe(dashboardQueryKeys.enrollments()[0])
    expect(onboardingQueryKeys.certifications()[0]).not.toBe(
      dashboardQueryKeys.certifications()[0],
    )
  })
})
