export type SessionTypeFilter = 'all' | 'study' | 'review'

// The sessions list endpoint exposes no kind/type query param, so this filter is a purely
// client-side view over the rows already loaded for the visible page, never a server round-trip.

export function filterSessionsByType<T extends { kind: unknown }>(
  rows: T[],
  filter: SessionTypeFilter,
): T[] {
  if (filter === 'all') {
    return rows
  }
  return rows.filter((row) => String(row.kind) === filter)
}
