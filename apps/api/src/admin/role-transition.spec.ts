import { UserRole } from '@readion/db'
import { describe, expect, it } from 'vitest'
import { demoteTransition, promoteTransition } from './role-transition'

describe('role transitions', () => {
  it('promotes a user to admin and reports the change', () => {
    expect(promoteTransition(UserRole.User)).toEqual({ role: UserRole.Admin, changed: true })
  })

  it('treats promoting an existing admin as a no-op', () => {
    expect(promoteTransition(UserRole.Admin)).toEqual({ role: UserRole.Admin, changed: false })
  })

  it('demotes an admin to user and reports the change', () => {
    expect(demoteTransition(UserRole.Admin)).toEqual({ role: UserRole.User, changed: true })
  })

  it('treats demoting an existing user as a no-op', () => {
    expect(demoteTransition(UserRole.User)).toEqual({ role: UserRole.User, changed: false })
  })
})
