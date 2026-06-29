import { describe, expect, it } from 'vitest'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'

describe('settings query keys', () => {
  it('builds a stable profile key', () => {
    expect(settingsQueryKeys.profile()).toEqual(['onboarding', 'profile'])
  })

  it('shares the profile cache entry with the onboarding gate', () => {
    expect(settingsQueryKeys.profile()).toEqual(onboardingQueryKeys.profile())
  })
})
