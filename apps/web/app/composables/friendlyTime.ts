// Compares UTC time-of-day fields rather than delegating to the runtime's local timezone, so the
// rendered clock time is deterministic in tests regardless of the machine running them — mirrors
// the trade-off already made by friendlyDate.ts.
export function friendlyTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }

  const date = new Date(iso)
  const hours24 = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const paddedMinutes = String(minutes).padStart(2, '0')

  return `${hours12}:${paddedMinutes} ${period}`
}
