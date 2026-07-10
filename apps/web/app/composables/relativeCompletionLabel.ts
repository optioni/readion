const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
})

const FULL_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

// "Today at h:mm A" for same-day completions (the design's relative header timestamp); older
// sessions fall back to a full date so the label never silently omits which day it happened.
export function formatRelativeCompletionLabel(iso: string, now: Date = new Date()): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  if (isSameUtcDay(date, now)) {
    return `Today at ${TIME_FORMAT.format(date)}`
  }
  return FULL_DATE_FORMAT.format(date)
}
