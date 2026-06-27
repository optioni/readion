import { UserRole, type UserRoleValue } from '@readion/db'

export interface RoleTransition {
  role: UserRoleValue
  changed: boolean
}

export function promoteTransition(current: UserRoleValue): RoleTransition {
  return { role: UserRole.Admin, changed: current !== UserRole.Admin }
}

export function demoteTransition(current: UserRoleValue): RoleTransition {
  return { role: UserRole.User, changed: current !== UserRole.User }
}
