export interface SessionFocusAreaEntry {
  startedAt: string
  focusArea: unknown
}

function focusAreaIncludesDomain(focusArea: unknown, domain: string): boolean {
  if (typeof focusArea !== 'object' || focusArea === null) {
    return false
  }
  if ((focusArea as { mode?: unknown }).mode !== 'domains') {
    return false
  }
  const domains = (focusArea as { domains?: unknown }).domains
  return Array.isArray(domains) && domains.includes(domain)
}

export function findLastStudiedAt(
  sessions: SessionFocusAreaEntry[],
  domain: string,
): string | null {
  const matches = sessions.filter((session) => focusAreaIncludesDomain(session.focusArea, domain))
  if (matches.length === 0) {
    return null
  }
  return matches.reduce(
    (latest, session) => (session.startedAt > latest ? session.startedAt : latest),
    matches[0]!.startedAt,
  )
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function daysSince(startedAt: string, now: Date): number {
  const diffMs = now.getTime() - new Date(startedAt).getTime()
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY))
}
