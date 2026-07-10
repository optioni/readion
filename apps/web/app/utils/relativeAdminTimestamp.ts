const CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

export type RelativeAdminTimestampStyle = 'duration' | 'clock'

// Shared relative-time helper for the admin screens: `duration` renders "2h ago" / "3 days ago"
// (Sources' last-ingested, Review queue's list dates); `clock` renders "Today 14:32" / "Jun 22 18:41"
// (Audit log's monospace timestamps). One function, two presentations, so every screen reads from
// the same clock-math instead of re-deriving it per component.
export function formatRelativeAdminTimestamp(
  iso: string,
  now: Date = new Date(),
  style: RelativeAdminTimestampStyle = 'duration',
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  if (style === 'clock') {
    if (isSameUtcDay(date, now)) {
      return `Today ${CLOCK_FORMAT.format(date)}`
    }
    return `${SHORT_DATE_FORMAT.format(date)} ${CLOCK_FORMAT.format(date)}`
  }

  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  return SHORT_DATE_FORMAT.format(date)
}
