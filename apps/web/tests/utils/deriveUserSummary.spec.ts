import type { AdminUserListItem } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { deriveUserSummary } from '~/utils/deriveUserSummary'

function user(role: AdminUserListItem['role']): AdminUserListItem {
  return {
    id: 'id',
    email: 'a@b.io',
    role,
    emailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    enrollmentCount: 0,
  }
}

describe('deriveUserSummary', () => {
  it('counts total users and admins separately', () => {
    const result = deriveUserSummary([user('admin'), user('user'), user('user')])

    expect(result).toEqual({ total: 3, admins: 1 })
  })

  it('returns zero counts for an empty list', () => {
    expect(deriveUserSummary([])).toEqual({ total: 0, admins: 0 })
  })

  it('counts all-admin lists correctly', () => {
    expect(deriveUserSummary([user('admin'), user('admin')])).toEqual({ total: 2, admins: 2 })
  })

  it('uses the provided total override instead of the page length when given', () => {
    const result = deriveUserSummary([user('admin'), user('user'), user('user')], 23)

    expect(result).toEqual({ total: 23, admins: 1 })
  })

  it('falls back to the page length when no total override is given', () => {
    const result = deriveUserSummary([user('admin'), user('user'), user('user')])

    expect(result).toEqual({ total: 3, admins: 1 })
  })
})
