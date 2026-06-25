import { describe, expect, it } from 'vitest'
import { shouldAbstain } from './abstention'
import type { GroundedChunk } from './types'

const THRESHOLD = 0.75

const HIGH_SIM_CHUNK: GroundedChunk = {
  id: 'chunk-1',
  text: 'Amazon EC2 provides scalable computing capacity.',
  similarity: 0.9,
  primaryDomain: 'compute',
}

const LOW_SIM_CHUNK: GroundedChunk = {
  id: 'chunk-2',
  text: 'Some loosely related content.',
  similarity: 0.5,
  primaryDomain: 'misc',
}

describe('shouldAbstain', () => {
  it('indicates abstention when all chunks are below the grounding threshold', () => {
    const result = shouldAbstain([LOW_SIM_CHUNK], THRESHOLD)
    expect(result.abstain).toBe(true)
    if (result.abstain) {
      expect(result.eligibleForFetchMoreMaterial).toBe(true)
    }
  })

  it('indicates no abstention when at least one chunk is at or above the threshold', () => {
    const result = shouldAbstain([LOW_SIM_CHUNK, HIGH_SIM_CHUNK], THRESHOLD)
    expect(result.abstain).toBe(false)
  })

  it('indicates no abstention when all chunks are above the threshold', () => {
    const result = shouldAbstain([HIGH_SIM_CHUNK], THRESHOLD)
    expect(result.abstain).toBe(false)
  })

  it('abstention is eligible for fetchMoreMaterial when material is thin', () => {
    const result = shouldAbstain([LOW_SIM_CHUNK], THRESHOLD)
    if (result.abstain) {
      expect(result.eligibleForFetchMoreMaterial).toBe(true)
    }
  })

  it('does not abstain when the chunk similarity equals the threshold exactly', () => {
    const chunk: GroundedChunk = { ...LOW_SIM_CHUNK, similarity: 0.75 }
    const result = shouldAbstain([chunk], THRESHOLD)
    expect(result.abstain).toBe(false)
  })

  it('indicates abstention with an empty chunk array', () => {
    const result = shouldAbstain([], THRESHOLD)
    expect(result.abstain).toBe(true)
  })
})
