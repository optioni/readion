import type { FetchedContent } from './fetch-strategy.interface'

// Requires explicit Front:/Back: markers rather than a loose heuristic, so an
// AnkiWeb markup change yields [] (a loud, visible non-success upstream)
// instead of silently emitting garbage chunks from unrelated page text.
const CARD_PATTERN = /Front:\s*(.+?)\s*\n\s*Back:\s*(.+?)(?=\n\s*Front:|\s*$)/gis

export function parseAnkiDeck(content: string, url: string): FetchedContent[] {
  const trimmed = content.trim()
  if (!trimmed) return []

  const results: FetchedContent[] = []
  for (const match of trimmed.matchAll(CARD_PATTERN)) {
    const front = match[1]?.trim()
    const back = match[2]?.trim()
    if (!front || !back) continue
    results.push({ text: `Q: ${front}\nA: ${back}`, url })
  }
  return results
}
