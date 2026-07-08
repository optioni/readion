import type { AdminUserListItem } from '@readion/shared'

export interface UserSummary {
  total: number
  admins: number
}

export function deriveUserSummary(users: AdminUserListItem[], total?: number): UserSummary {
  return {
    total: total ?? users.length,
    admins: users.filter((user) => user.role === 'admin').length,
  }
}
