export interface DigestDueInput {
  /** UTC instant of "now" (injectable for tests). */
  now: Date
  /** IANA timezone, e.g. 'Europe/Helsinki'. */
  displayTimezone: string
  digestOptOut: boolean
  /** UTC instant of the last digest send, or null if never sent. */
  lastDigestSentAt: Date | null
  /** 0=Sunday .. 6=Saturday (JS `Date.getDay()` convention). */
  sendWeekday: number
  /** Local hour of day, 0-23. */
  sendHour: number
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getLocalParts(instant: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const local = getLocalParts(instant, timeZone)
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  )
  return asUtc - instant.getTime()
}

/**
 * A user is due for their weekly digest when, rendered in their local timezone,
 * it is the configured send weekday and hour AND no digest has been sent during
 * the current local week. The local week is defined as starting at local
 * midnight (00:00) of the send weekday — i.e. the day the digest fires — so the
 * last-sent throttle can neither double-send nor skip a week.
 */
export function isDigestDue(input: DigestDueInput): boolean {
  if (input.digestOptOut) {
    return false
  }

  const local = getLocalParts(input.now, input.displayTimezone)
  const localWeekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()

  if (localWeekday !== input.sendWeekday || local.hour !== input.sendHour) {
    return false
  }

  if (input.lastDigestSentAt === null) {
    return true
  }

  const localMidnightAsUtc = Date.UTC(local.year, local.month - 1, local.day, 0, 0, 0)
  const offset = getTimeZoneOffsetMs(new Date(localMidnightAsUtc), input.displayTimezone)
  const weekStartUtc = localMidnightAsUtc - offset

  return input.lastDigestSentAt.getTime() < weekStartUtc
}
