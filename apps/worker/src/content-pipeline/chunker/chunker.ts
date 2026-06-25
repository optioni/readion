import { createHash } from 'node:crypto'

export interface Chunk {
  text: string
  contentHash: string
}

export interface ChunkOptions {
  chunkSize: number
  overlap: number
}

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function deriveContentHash(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex')
}

export function chunkText(text: string, { chunkSize, overlap }: ChunkOptions): Chunk[] {
  const words = text.trim().split(/\s+/)
  if (words.length <= chunkSize) {
    return [{ text: text.trim(), contentHash: deriveContentHash(text) }]
  }

  const chunks: Chunk[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length)
    const chunkWords = words.slice(start, end)
    const chunkText = chunkWords.join(' ')
    chunks.push({ text: chunkText, contentHash: deriveContentHash(chunkText) })
    if (end >= words.length) break
    start = end - overlap
  }

  return chunks
}
