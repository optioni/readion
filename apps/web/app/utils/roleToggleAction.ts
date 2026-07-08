import type { RoleValue } from '@readion/shared'

export type RoleToggleAction = 'promote' | 'demote'

export function roleToggleAction(role: RoleValue): RoleToggleAction {
  return role === 'admin' ? 'demote' : 'promote'
}
