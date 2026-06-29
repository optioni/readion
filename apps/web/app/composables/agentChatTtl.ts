export const TTL_WINDOW_MS = 4 * 60 * 60 * 1000
export const TTL_WARNING_THRESHOLD_MS = 15 * 60 * 1000

export function ttlRemainingMs(lastActivityAt: string | null, now: number): number {
  if (lastActivityAt === null) {
    return TTL_WINDOW_MS
  }
  const lastActivity = new Date(lastActivityAt).getTime()
  if (Number.isNaN(lastActivity)) {
    return TTL_WINDOW_MS
  }
  return Math.max(0, lastActivity + TTL_WINDOW_MS - now)
}

export function isTtlWarning(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= TTL_WARNING_THRESHOLD_MS
}

export function formatTtlRemaining(remainingMs: number): string {
  const totalMinutes = Math.floor(remainingMs / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
