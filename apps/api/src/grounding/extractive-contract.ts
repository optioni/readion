import type { ExtractiveItem } from '@readion/shared'

export type ChunkRef = {
  id: string
  text: string
}

export type ContractValid = { valid: true }
export type ContractInvalid = { valid: false; error: string; offendingSpan?: string }
export type ContractResult = ContractValid | ContractInvalid

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function validateExtractiveContract(
  item: ExtractiveItem,
  chunks: ChunkRef[],
): ContractResult {
  const chunkMap = new Map(chunks.map((c) => [c.id, c]))

  for (const id of item.sourceChunkIds) {
    if (!chunkMap.has(id)) {
      return { valid: false, error: `sourceChunkId not in supplied chunk set: ${id}` }
    }
  }

  for (const span of item.supportingSpans) {
    const normalizedSpan = normalizeText(span)
    const foundInCitedChunk = item.sourceChunkIds.some((id) => {
      const chunk = chunkMap.get(id)
      return chunk !== undefined && normalizeText(chunk.text).includes(normalizedSpan)
    })
    if (!foundInCitedChunk) {
      return {
        valid: false,
        error: 'Supporting span not found verbatim in any cited chunk',
        offendingSpan: span,
      }
    }
  }

  const normalizedAnswer = normalizeText(item.correctAnswer).toLowerCase()
  const answerBacked = item.supportingSpans.some((span) =>
    normalizeText(span).toLowerCase().includes(normalizedAnswer),
  )
  if (!answerBacked) {
    return { valid: false, error: 'Correct answer not backed by any supporting span' }
  }

  return { valid: true }
}
