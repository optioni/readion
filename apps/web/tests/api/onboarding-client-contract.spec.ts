import { describe, expect, it } from 'vitest'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { diagnosticControllerCreate, diagnosticControllerDismissOffer, diagnosticControllerGetOffer } from '~~/src/api/diagnostic/diagnostic'
import { userCertificationsControllerEnroll, userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe, usersControllerUpdateMe } from '~~/src/api/users/users'

describe('onboarding client contract', () => {
  it('exposes every Orval client method the onboarding flow depends on', () => {
    expect(typeof certificationsControllerList).toBe('function')
    expect(typeof usersControllerGetMe).toBe('function')
    expect(typeof usersControllerUpdateMe).toBe('function')
    expect(typeof userCertificationsControllerEnroll).toBe('function')
    expect(typeof userCertificationsControllerList).toBe('function')
    expect(typeof diagnosticControllerGetOffer).toBe('function')
    expect(typeof diagnosticControllerCreate).toBe('function')
    expect(typeof diagnosticControllerDismissOffer).toBe('function')
  })
})
