import { describe, expect, it } from 'vitest'
import { computeReadiness, type ReadinessCalculatorInput } from './readiness.calculator'

const NOW = new Date('2026-06-26T12:00:00.000Z')

function baseInput(overrides: Partial<ReadinessCalculatorInput> = {}): ReadinessCalculatorInput {
  return {
    perDomainScores: [],
    domainWeights: [],
    mockResults: [],
    now: NOW,
    ...overrides,
  }
}

describe('computeReadiness', () => {
  it('returns a value within 0–100 and is pure (same inputs → same value)', () => {
    const input = baseInput({
      perDomainScores: [{ domain: 'Security', score: 80, lastActivityAt: NOW }],
      domainWeights: [{ domain: 'Security', weight: 100 }],
    })

    const a = computeReadiness(input)
    const b = computeReadiness(input)

    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(100)
  })

  it('weights a stronger heavily-weighted domain more than a lightly-weighted one', () => {
    const base = 50
    const margin = 40

    const enrollmentA = computeReadiness(
      baseInput({
        perDomainScores: [
          { domain: 'Heavy', score: base + margin, lastActivityAt: NOW },
          { domain: 'Light', score: base, lastActivityAt: NOW },
        ],
        domainWeights: [
          { domain: 'Heavy', weight: 30 },
          { domain: 'Light', weight: 10 },
        ],
      }),
    )

    const enrollmentB = computeReadiness(
      baseInput({
        perDomainScores: [
          { domain: 'Heavy', score: base, lastActivityAt: NOW },
          { domain: 'Light', score: base + margin, lastActivityAt: NOW },
        ],
        domainWeights: [
          { domain: 'Heavy', weight: 30 },
          { domain: 'Light', weight: 10 },
        ],
      }),
    )

    expect(enrollmentA).toBeGreaterThan(enrollmentB)
  })

  it('weights a recent strong domain more than the same strong domain long ago', () => {
    const old = new Date(NOW.getTime() - 120 * 24 * 60 * 60 * 1000)

    const recent = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 95, lastActivityAt: NOW }],
        domainWeights: [{ domain: 'Security', weight: 100 }],
      }),
    )

    const stale = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 95, lastActivityAt: old }],
        domainWeights: [{ domain: 'Security', weight: 100 }],
      }),
    )

    expect(recent).toBeGreaterThan(stale)
  })

  it('weights a strong mock at least as much as equivalent session-quiz performance', () => {
    const withMock = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 80, lastActivityAt: NOW }],
        domainWeights: [{ domain: 'Security', weight: 100 }],
        mockResults: [{ score: 95, at: NOW }],
      }),
    )

    const withoutMock = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 80, lastActivityAt: NOW }],
        domainWeights: [{ domain: 'Security', weight: 100 }],
        mockResults: [],
      }),
    )

    expect(withMock).toBeGreaterThanOrEqual(withoutMock)
    expect(withMock).toBeGreaterThan(withoutMock)
  })

  it('returns a numeric score with zero mocks', () => {
    const score = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 70, lastActivityAt: NOW }],
        domainWeights: [{ domain: 'Security', weight: 100 }],
        mockResults: [],
      }),
    )

    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThan(0)
  })

  it('treats a weighted domain with no score as neutral without throwing', () => {
    const score = computeReadiness(
      baseInput({
        perDomainScores: [{ domain: 'Security', score: 90, lastActivityAt: NOW }],
        domainWeights: [
          { domain: 'Security', weight: 50 },
          { domain: 'Billing', weight: 50 },
        ],
      }),
    )

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeLessThan(90)
  })
})
