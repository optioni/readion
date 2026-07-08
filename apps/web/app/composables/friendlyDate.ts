const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

// Compares UTC calendar-day fields rather than delegating to the runtime's local timezone, so the
// "Today, Mon D" vs. absolute "Mon D" decision is deterministic in tests regardless of the machine
// running them.
export function friendlyDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) {
    return '—'
  }

  const date = new Date(iso)
  const absolute = `${MONTH_ABBREVIATIONS[date.getUTCMonth()]} ${date.getUTCDate()}`

  const isToday =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()

  return isToday ? `Today, ${absolute}` : absolute
}
