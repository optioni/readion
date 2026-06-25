import { describe, expect, it } from 'vitest'
import type {
  DistractorFinding,
  ExtractiveItem,
  FetchMoreMaterialSignal,
  GroundingSignal,
  Provenance,
  SubstitutionSignal,
  VerifierVerdict,
} from './types'

describe('shared grounding types', () => {
  it('ExtractiveItem carries all required fields', () => {
    const item: ExtractiveItem = {
      question: 'What does EC2 provide?',
      options: ['Scalable compute', 'Object storage', 'DNS', 'Load balancing'],
      correctAnswer: 'Scalable compute',
      supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
      sourceChunkIds: ['chunk-1'],
    }
    expect(item.question).toBeDefined()
    expect(item.options).toHaveLength(4)
    expect(item.correctAnswer).toBeDefined()
    expect(item.supportingSpans).toHaveLength(1)
    expect(item.sourceChunkIds).toHaveLength(1)
  })

  it('VerifierVerdict carries pass/fail, score, and per-distractor findings', () => {
    const finding: DistractorFinding = {
      option: 'Object storage',
      isCorrect: false,
      reason: 'Not mentioned as a feature of EC2',
    }
    const verdict: VerifierVerdict = {
      pass: true,
      score: 0.95,
      distractorFindings: [finding],
    }
    expect(verdict.pass).toBe(true)
    expect(verdict.score).toBe(0.95)
    expect(verdict.distractorFindings[0]?.option).toBe('Object storage')
  })

  it('Provenance snapshot is self-contained — serializes with all required fields', () => {
    const verdict: VerifierVerdict = { pass: true, score: 0.9, distractorFindings: [] }
    const provenance: Provenance = {
      sourceChunkIds: ['chunk-1'],
      supportingSpans: ['EC2 provides scalable compute'],
      verdict,
      score: 0.9,
    }

    const serialized = JSON.stringify(provenance)
    const deserialized = JSON.parse(serialized) as Provenance

    expect(deserialized.sourceChunkIds).toEqual(['chunk-1'])
    expect(deserialized.supportingSpans).toEqual(['EC2 provides scalable compute'])
    expect(deserialized.verdict.pass).toBe(true)
    expect(deserialized.score).toBe(0.9)
  })

  it('FetchMoreMaterialSignal carries certificationId and domain', () => {
    const signal: FetchMoreMaterialSignal = {
      type: 'fetchMoreMaterial',
      certificationId: 'aws-saa',
      domain: 'compute',
    }
    expect(signal.type).toBe('fetchMoreMaterial')
    expect(signal.certificationId).toBe('aws-saa')
    expect(signal.domain).toBe('compute')
  })

  it('SubstitutionSignal has a literal type field', () => {
    const signal: SubstitutionSignal = { type: 'substitution' }
    expect(signal.type).toBe('substitution')
  })

  it('GroundingSignal is the union of FetchMoreMaterial and Substitution', () => {
    const signals: GroundingSignal[] = [
      { type: 'fetchMoreMaterial', certificationId: 'aws-saa', domain: 'compute' },
      { type: 'substitution' },
    ]
    expect(signals).toHaveLength(2)
    expect(signals[0]?.type).toBe('fetchMoreMaterial')
    expect(signals[1]?.type).toBe('substitution')
  })
})
