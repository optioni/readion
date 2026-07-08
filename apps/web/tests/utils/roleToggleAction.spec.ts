import { describe, expect, it } from 'vitest'
import { roleToggleAction } from '~/utils/roleToggleAction'

describe('roleToggleAction', () => {
  it('returns promote for a user role', () => {
    expect(roleToggleAction('user')).toBe('promote')
  })

  it('returns demote for an admin role', () => {
    expect(roleToggleAction('admin')).toBe('demote')
  })
})
