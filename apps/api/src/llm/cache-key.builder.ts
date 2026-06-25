import { createHash } from 'node:crypto'

export type CacheKeyInput = {
  certificationId: string
  chunkIds: string[]
  difficulty: string
  format: string
}

export function buildCacheKey(input: CacheKeyInput): string {
  const canonical = JSON.stringify({
    certificationId: input.certificationId,
    sortedChunkIds: [...input.chunkIds].sort(),
    difficulty: input.difficulty,
    format: input.format,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
