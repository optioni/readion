import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  evaluateCoverage,
} from './evaluate-coverage'

const DEFAULT_THRESHOLDS = {
  minChunksPerDomain: DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  totalChunkMultiple: DEFAULT_TOTAL_CHUNK_MULTIPLE,
}

describe('evaluateCoverage', () => {
  it('all three criteria satisfied marks the bar met', () => {
    const result = evaluateCoverage(
      ['IAM', 'Security'],
      [
        { name: 'IAM', chunkCount: 25, enabledSourceCount: 1 },
        { name: 'Security', chunkCount: 25, enabledSourceCount: 1 },
      ],
      200,
      50,
      DEFAULT_THRESHOLDS,
    )

    expect(result.met).toBe(true)
    expect(result.totalChunks).toBe(200)
    expect(result.totalThreshold).toBe(150) // 3 × 50

    const iam = result.domains.find((d) => d.name === 'IAM')
    expect(iam?.chunkCount).toBe(25)
    expect(iam?.chunkThreshold).toBe(20)
    expect(iam?.met).toBe(true)
  })

  it('a domain below the per-domain minimum fails the bar', () => {
    const result = evaluateCoverage(
      ['IAM', 'Security'],
      [
        { name: 'IAM', chunkCount: 25, enabledSourceCount: 1 },
        { name: 'Security', chunkCount: 12, enabledSourceCount: 1 },
      ],
      200,
      50,
      DEFAULT_THRESHOLDS,
    )

    expect(result.met).toBe(false)

    const security = result.domains.find((d) => d.name === 'Security')
    expect(security?.chunkCount).toBe(12)
    expect(security?.chunkThreshold).toBe(20)
    expect(security?.met).toBe(false)
  })

  it('insufficient total chunks fails the bar', () => {
    // questionCount=65 → threshold=195, but total=150
    const result = evaluateCoverage(
      ['IAM', 'Security'],
      [
        { name: 'IAM', chunkCount: 75, enabledSourceCount: 1 },
        { name: 'Security', chunkCount: 75, enabledSourceCount: 1 },
      ],
      150,
      65,
      DEFAULT_THRESHOLDS,
    )

    expect(result.met).toBe(false)
    expect(result.totalChunks).toBe(150)
    expect(result.totalThreshold).toBe(195)
  })

  it('a domain with chunks but no enabled source fails the bar', () => {
    const result = evaluateCoverage(
      ['IAM', 'Security'],
      [
        { name: 'IAM', chunkCount: 30, enabledSourceCount: 0 },
        { name: 'Security', chunkCount: 25, enabledSourceCount: 1 },
      ],
      200,
      50,
      DEFAULT_THRESHOLDS,
    )

    expect(result.met).toBe(false)

    const iam = result.domains.find((d) => d.name === 'IAM')
    expect(iam?.enabledSourceCount).toBe(0)
    expect(iam?.met).toBe(false)
  })

  it('a configured domain with zero chunks (absent from domainStats) is zero-filled and fails the bar', () => {
    const result = evaluateCoverage(
      ['IAM', 'Security', 'Networking'],
      [
        { name: 'IAM', chunkCount: 25, enabledSourceCount: 1 },
        { name: 'Security', chunkCount: 25, enabledSourceCount: 1 },
        // Networking absent from domainStats — zero chunks
      ],
      200,
      50,
      DEFAULT_THRESHOLDS,
    )

    expect(result.met).toBe(false)

    const networking = result.domains.find((d) => d.name === 'Networking')
    expect(networking).toBeDefined()
    expect(networking?.chunkCount).toBe(0)
    expect(networking?.chunkThreshold).toBe(20)
    expect(networking?.met).toBe(false)
  })

  it('superseded chunks scenario: only the provided totalChunks value is used (no double-counting)', () => {
    // 18 active chunks reported for a domain (superseded excluded by caller)
    const result = evaluateCoverage(
      ['Security'],
      [{ name: 'Security', chunkCount: 18, enabledSourceCount: 1 }],
      18,
      1,
      DEFAULT_THRESHOLDS,
    )

    const security = result.domains.find((d) => d.name === 'Security')
    expect(security?.chunkCount).toBe(18)
    // threshold is 20, so 18 < 20 → not met
    expect(security?.met).toBe(false)
    expect(result.met).toBe(false)
  })

  it('empty domain list fails the bar', () => {
    const result = evaluateCoverage([], [], 200, 50, DEFAULT_THRESHOLDS)

    expect(result.met).toBe(false)
    expect(result.domains).toHaveLength(0)
  })

  it('overridden per-domain minimum changes the bar', () => {
    const result = evaluateCoverage(
      ['IAM', 'Security'],
      [
        { name: 'IAM', chunkCount: 10, enabledSourceCount: 1 },
        { name: 'Security', chunkCount: 10, enabledSourceCount: 1 },
      ],
      100,
      10,
      { minChunksPerDomain: 10, totalChunkMultiple: 3 },
    )

    expect(result.met).toBe(true)
    expect(result.domains.every((d) => d.chunkThreshold === 10)).toBe(true)
  })

  it('defaults are 20 and 3', () => {
    expect(DEFAULT_MIN_CHUNKS_PER_DOMAIN).toBe(20)
    expect(DEFAULT_TOTAL_CHUNK_MULTIPLE).toBe(3)
  })
})
