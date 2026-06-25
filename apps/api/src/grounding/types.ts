export type GroundedChunk = {
  id: string
  text: string
  similarity: number
  primaryDomain: string
}

export type GenerationFn = (
  chunks: GroundedChunk[],
) => Promise<import('@readion/shared').ExtractiveItem>

export type GenerationOptions = {
  cacheKey: string
  certificationId: string
  domain: string
}

export type GroundedGenerationSuccess = {
  success: true
  item: import('@readion/shared').ExtractiveItem
  provenance: import('@readion/shared').Provenance
  regenerations: number
}

export type GroundedGenerationFailure = {
  success: false
  signal: import('@readion/shared').GroundingSignal
}

export type GroundedGenerationResult = GroundedGenerationSuccess | GroundedGenerationFailure
