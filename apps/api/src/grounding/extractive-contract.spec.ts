import type { ExtractiveItem } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { type ChunkRef, validateExtractiveContract } from './extractive-contract'

const CHUNK_A: ChunkRef = {
  id: 'chunk-1',
  text: 'Amazon EC2 provides scalable computing capacity in the cloud.',
}
const CHUNK_B: ChunkRef = {
  id: 'chunk-2',
  text: 'EBS volumes provide block-level storage for EC2 instances.',
}

const VALID_ITEM: ExtractiveItem = {
  question: 'What does EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

describe('validateExtractiveContract', () => {
  it('passes when every supportingSpan is verbatim in a cited chunk and the correct answer is backed', () => {
    const result = validateExtractiveContract(VALID_ITEM, [CHUNK_A, CHUNK_B])
    expect(result.valid).toBe(true)
  })

  it('fails when a supportingSpan is absent from every cited chunk, identifying the offending span', () => {
    const item: ExtractiveItem = {
      ...VALID_ITEM,
      supportingSpans: ['This span does not exist in any chunk'],
    }
    const result = validateExtractiveContract(item, [CHUNK_A, CHUNK_B])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.offendingSpan).toBe('This span does not exist in any chunk')
    }
  })

  it('fails when the correct answer has no supporting span backing it', () => {
    const item: ExtractiveItem = {
      ...VALID_ITEM,
      correctAnswer: 'Something not covered by any span',
      supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    }
    const result = validateExtractiveContract(item, [CHUNK_A, CHUNK_B])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toMatch(/correct answer/i)
    }
  })

  it('fails when sourceChunkIds contains an id not present in the supplied chunk set', () => {
    const item: ExtractiveItem = {
      ...VALID_ITEM,
      sourceChunkIds: ['chunk-1', 'chunk-nonexistent'],
    }
    const result = validateExtractiveContract(item, [CHUNK_A])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toMatch(/chunk-nonexistent/)
    }
  })

  it('applies whitespace/markup normalization before comparison so minor formatting differences do not fail', () => {
    const chunkWithExtraSpaces: ChunkRef = {
      id: 'chunk-1',
      text: 'Amazon  EC2   provides   scalable  computing   capacity  in  the  cloud.',
    }
    const spanWithNormalSpaces: ExtractiveItem = {
      ...VALID_ITEM,
      supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    }
    const result = validateExtractiveContract(spanWithNormalSpaces, [chunkWithExtraSpaces])
    expect(result.valid).toBe(true)
  })

  it('passes with multiple supportingSpans all present in cited chunks', () => {
    const item: ExtractiveItem = {
      ...VALID_ITEM,
      supportingSpans: [
        'Amazon EC2 provides scalable computing capacity',
        'EBS volumes provide block-level storage',
      ],
      sourceChunkIds: ['chunk-1', 'chunk-2'],
    }
    const result = validateExtractiveContract(item, [CHUNK_A, CHUNK_B])
    expect(result.valid).toBe(true)
  })

  it('fails when a span references a valid chunk id but the text is not present in that chunk', () => {
    const item: ExtractiveItem = {
      ...VALID_ITEM,
      supportingSpans: ['EBS volumes provide block-level storage'],
      sourceChunkIds: ['chunk-1'],
    }
    const result = validateExtractiveContract(item, [CHUNK_A, CHUNK_B])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.offendingSpan).toBe('EBS volumes provide block-level storage')
    }
  })
})
