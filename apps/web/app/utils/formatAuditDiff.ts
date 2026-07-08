export interface AuditDiff {
  before: string
  after: string
}

function formatAuditSnapshot(snapshot: Record<string, unknown> | null): string {
  if (snapshot === null) {
    return '—'
  }

  const entries = Object.entries(snapshot)
  if (entries.length === 0) {
    return '—'
  }
  const [singleEntry] = entries
  if (entries.length === 1 && singleEntry) {
    return String(singleEntry[1])
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ')
}

export function formatAuditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditDiff {
  return {
    before: formatAuditSnapshot(before),
    after: formatAuditSnapshot(after),
  }
}
