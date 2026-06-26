import { describe, expect, it } from 'vitest'
import { summarizeResponses } from './accuracy-rollup'

describe('summarizeResponses', () => {
  it('empty response set returns questionsAnswered=0, accuracy=0, domains=[]', () => {
    const result = summarizeResponses([])
    expect(result.questionsAnswered).toBe(0)
    expect(result.accuracy).toBe(0)
    expect(result.domains).toEqual([])
  })

  it('all correct single domain yields accuracy 1.0 and one domain entry with accuracy 1.0', () => {
    const result = summarizeResponses([
      { correct: true, confidence: 3, primaryDomain: 'networking' },
      { correct: true, confidence: 4, primaryDomain: 'networking' },
      { correct: true, confidence: 5, primaryDomain: 'networking' },
    ])
    expect(result.questionsAnswered).toBe(3)
    expect(result.accuracy).toBe(1.0)
    expect(result.domains).toHaveLength(1)
    expect(result.domains[0]).toEqual({ domain: 'networking', accuracy: 1.0 })
  })

  it('4 out of 6 correct across two domains returns overall accuracy 0.6667', () => {
    const result = summarizeResponses([
      { correct: true, confidence: 3, primaryDomain: 'compute' },
      { correct: true, confidence: 3, primaryDomain: 'compute' },
      { correct: false, confidence: 2, primaryDomain: 'compute' },
      { correct: true, confidence: 4, primaryDomain: 'storage' },
      { correct: true, confidence: 4, primaryDomain: 'storage' },
      { correct: false, confidence: 1, primaryDomain: 'storage' },
    ])
    expect(result.questionsAnswered).toBe(6)
    expect(result.accuracy).toBe(Math.round((4 / 6) * 10000) / 10000)
    expect(result.domains).toHaveLength(2)
  })

  it('all wrong single domain yields accuracy 0', () => {
    const result = summarizeResponses([
      { correct: false, confidence: 1, primaryDomain: 'security' },
      { correct: false, confidence: 2, primaryDomain: 'security' },
    ])
    expect(result.questionsAnswered).toBe(2)
    expect(result.accuracy).toBe(0)
    expect(result.domains).toHaveLength(1)
    expect(result.domains[0]).toEqual({ domain: 'security', accuracy: 0 })
  })

  it('accuracy is rounded to 4 decimal places (1/3 = 0.3333)', () => {
    const result = summarizeResponses([
      { correct: true, confidence: 3, primaryDomain: 'iam' },
      { correct: false, confidence: 2, primaryDomain: 'iam' },
      { correct: false, confidence: 2, primaryDomain: 'iam' },
    ])
    expect(result.accuracy).toBe(0.3333)
  })

  it('per-domain accuracy is computed independently per domain', () => {
    const result = summarizeResponses([
      { correct: true, confidence: 4, primaryDomain: 'compute' },
      { correct: true, confidence: 4, primaryDomain: 'compute' },
      { correct: false, confidence: 1, primaryDomain: 'networking' },
      { correct: false, confidence: 1, primaryDomain: 'networking' },
    ])
    expect(result.accuracy).toBe(0.5)
    const compute = result.domains.find((d) => d.domain === 'compute')
    const networking = result.domains.find((d) => d.domain === 'networking')
    expect(compute).toBeDefined()
    expect(networking).toBeDefined()
    expect(compute?.accuracy).toBe(1.0)
    expect(networking?.accuracy).toBe(0)
  })

  it('responses from different domains contribute only to their own domain stat', () => {
    const result = summarizeResponses([
      { correct: true, confidence: 5, primaryDomain: 'domainA' },
      { correct: false, confidence: 1, primaryDomain: 'domainB' },
      { correct: false, confidence: 1, primaryDomain: 'domainB' },
    ])
    const domainA = result.domains.find((d) => d.domain === 'domainA')
    const domainB = result.domains.find((d) => d.domain === 'domainB')
    expect(domainA?.accuracy).toBe(1.0)
    expect(domainB?.accuracy).toBe(0)
    expect(result.questionsAnswered).toBe(3)
  })
})
