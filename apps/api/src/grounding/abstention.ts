import type { GroundedChunk } from './types'

export type AbstentionOk = { abstain: false }
export type AbstentionRequired = { abstain: true; eligibleForFetchMoreMaterial: true }
export type AbstentionResult = AbstentionOk | AbstentionRequired

export function shouldAbstain(chunks: GroundedChunk[], threshold: number): AbstentionResult {
  const hasSufficientContext = chunks.some((c) => c.similarity >= threshold)
  if (hasSufficientContext) {
    return { abstain: false }
  }
  return { abstain: true, eligibleForFetchMoreMaterial: true }
}
