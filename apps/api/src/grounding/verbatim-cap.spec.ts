import { describe, expect, it } from 'vitest'
import { checkVerbatimCap } from './verbatim-cap'

const CAP = 100

describe('checkVerbatimCap', () => {
  it('reports no violation when total verbatim characters are within the cap', () => {
    const spans = ['Amazon EC2 provides scalable compute']
    const result = checkVerbatimCap(spans, CAP)
    expect(result.violation).toBe(false)
  })

  it('reports a violation when total verbatim characters exceed the cap', () => {
    const longSpan = 'A'.repeat(150)
    const result = checkVerbatimCap([longSpan], CAP)
    expect(result.violation).toBe(true)
    if (result.violation) {
      expect(result.excess).toBe(50)
    }
  })

  it('sums multiple spans for the total character count', () => {
    const spans = ['A'.repeat(60), 'B'.repeat(60)]
    const result = checkVerbatimCap(spans, CAP)
    expect(result.violation).toBe(true)
    if (result.violation) {
      expect(result.excess).toBe(20)
    }
  })

  it('passes when total characters exactly equal the cap', () => {
    const spans = ['A'.repeat(100)]
    const result = checkVerbatimCap(spans, CAP)
    expect(result.violation).toBe(false)
  })

  it('passes with an empty spans array', () => {
    const result = checkVerbatimCap([], CAP)
    expect(result.violation).toBe(false)
  })

  it('identifies the excess amount in the violation', () => {
    const spans = ['A'.repeat(200)]
    const result = checkVerbatimCap(spans, CAP)
    expect(result.violation).toBe(true)
    if (result.violation) {
      expect(result.excess).toBe(100)
    }
  })
})
