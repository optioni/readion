import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Provenance } from '../grounding'
import type { QuestionFormat } from '../quiz'
import {
  type QuarantinedItemDetail,
  type QuarantinedItemDetailContent,
  type QuarantinedItemListItem,
  quarantinedItemDetailContentSchema,
} from './index'

describe('quarantinedItemDetailContentSchema', () => {
  it('parses a valid content object', () => {
    const input = {
      question: 'Which AWS service provides managed Kubernetes?',
      options: ['ECS', 'EKS', 'EMR', 'ECR'],
      answerKey: 'EKS',
      format: 'multiple_choice',
      supportingSpans: ['Amazon EKS is a managed Kubernetes service.'],
      sourceChunkIds: ['chunk-abc-123'],
    }
    const result = quarantinedItemDetailContentSchema.parse(input)
    expect(result.question).toBe(input.question)
    expect(result.options).toEqual(input.options)
    expect(result.answerKey).toBe(input.answerKey)
    expect(result.format).toBe('multiple_choice')
    expect(result.supportingSpans).toEqual(input.supportingSpans)
    expect(result.sourceChunkIds).toEqual(input.sourceChunkIds)
  })

  it('accepts format: null', () => {
    const input = {
      question: 'Is Lambda serverless?',
      options: ['True', 'False'],
      answerKey: 'True',
      format: null,
      supportingSpans: [],
      sourceChunkIds: [],
    }
    const result = quarantinedItemDetailContentSchema.parse(input)
    expect(result.format).toBeNull()
  })

  it('rejects when question is missing', () => {
    const input = {
      options: ['A', 'B'],
      answerKey: 'A',
      format: null,
      supportingSpans: [],
      sourceChunkIds: [],
    }
    expect(() => quarantinedItemDetailContentSchema.parse(input)).toThrow()
  })

  it('rejects when an option is not a string', () => {
    const input = {
      question: 'What is EC2?',
      options: ['Compute', 42],
      answerKey: 'Compute',
      format: null,
      supportingSpans: [],
      sourceChunkIds: [],
    }
    expect(() => quarantinedItemDetailContentSchema.parse(input)).toThrow()
  })
})

describe('QuarantinedItemDetail type', () => {
  it('extends QuarantinedItemListItem with content field', () => {
    const provenance: Provenance = {
      sourceChunkIds: ['chunk-1'],
      supportingSpans: ['some span'],
      verdict: { pass: true, score: 0.9, distractorFindings: [] },
    }
    const content: QuarantinedItemDetailContent = {
      question: 'What is S3?',
      options: ['Object storage', 'Compute', 'DNS', 'CDN'],
      answerKey: 'Object storage',
      format: 'multiple_choice' as QuestionFormat,
      supportingSpans: ['S3 is object storage.'],
      sourceChunkIds: ['chunk-2'],
    }
    const detail: QuarantinedItemDetail = {
      id: 'item-1',
      certificationId: 'cert-1',
      domain: 'Storage',
      verdict: 'pass',
      reason: 'Correct question',
      status: 'pending',
      provenance,
      createdAt: '2026-01-01T00:00:00.000Z',
      content,
    }
    expect(detail.id).toBe('item-1')
    expect(detail.content?.question).toBe('What is S3?')
    expectTypeOf<QuarantinedItemDetail>().toMatchTypeOf<
      QuarantinedItemListItem & { content: QuarantinedItemDetailContent | null }
    >()
  })

  it('accepts content: null', () => {
    const provenance: Provenance = {
      sourceChunkIds: [],
      supportingSpans: [],
      verdict: { pass: false, score: 0.1, distractorFindings: [] },
    }
    const detail: QuarantinedItemDetail = {
      id: 'item-2',
      certificationId: 'cert-2',
      domain: 'Compute',
      verdict: 'fail',
      reason: 'No content',
      status: 'rejected',
      provenance,
      createdAt: '2026-01-01T00:00:00.000Z',
      content: null,
    }
    expect(detail.content).toBeNull()
  })
})
