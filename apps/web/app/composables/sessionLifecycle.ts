import { type SessionStatus, sessionStatuses } from '@readion/shared'

export function toSessionStatus(value: unknown): SessionStatus {
  return typeof value === 'string' && (sessionStatuses as readonly string[]).includes(value)
    ? (value as SessionStatus)
    : 'active'
}

export function isActiveSessionStatus(status: SessionStatus): boolean {
  return status === 'active'
}

export function isEndedSessionStatus(status: SessionStatus): boolean {
  return !isActiveSessionStatus(status)
}
