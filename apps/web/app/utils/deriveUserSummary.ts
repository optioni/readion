import type { AdminUserListItem } from '@readion/shared'

export interface UserSummary {
  total: number
  admins: number
}

export function deriveUserSummary(users: AdminUserListItem[]): UserSummary {
  return {
    total: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
  }
}
