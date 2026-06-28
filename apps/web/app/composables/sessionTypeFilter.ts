export type SessionTypeFilter = 'all' | 'study' | 'review'

export function filterSessionsByType<T extends { kind: unknown }>(
  rows: T[],
  filter: SessionTypeFilter,
): T[] {
  if (filter === 'all') {
    return rows
  }
  return rows.filter((row) => String(row.kind) === filter)
}
