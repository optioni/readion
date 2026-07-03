import { describe, expect, it } from 'vitest'
import { mapGeneratedContent } from './quarantine-admin.service'

describe('mapGeneratedContent', () => {
  it('maps a valid { item, format } row to typed detail content', () => {
    const result = mapGeneratedContent({
      item: {
        question: 'What does Amazon EC2 provide?',
        options: ['Scalable computing capacity', 'Object storage'],
        correctAnswer: 'Scalable computing capacity',
        supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
        sourceChunkIds: ['chunk-1'],
      },
      format: 'multiple_choice',
    })

    expect(result).toEqual({
      question: 'What does Amazon EC2 provide?',
      options: ['Scalable computing capacity', 'Object storage'],
      answerKey: 'Scalable computing capacity',
      format: 'multiple_choice',
      supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
      sourceChunkIds: ['chunk-1'],
    })
  })

  it('returns null when generatedContent is null', () => {
    expect(mapGeneratedContent(null)).toBeNull()
  })

  it('returns null when item is missing', () => {
    expect(mapGeneratedContent({ format: 'multiple_choice' })).toBeNull()
  })

  it('returns null when item is not an object', () => {
    expect(mapGeneratedContent({ item: 'nope' })).toBeNull()
  })

  it('returns null when item.question is missing', () => {
    expect(mapGeneratedContent({ item: { options: [] } })).toBeNull()
  })

  it('returns null when item.question is an empty string', () => {
    expect(mapGeneratedContent({ item: { question: '' } })).toBeNull()
  })

  it('defaults options to [] for non-quiz rows that lack an options array', () => {
    const result = mapGeneratedContent({
      item: { question: 'Explain VPC peering.' },
    })

    expect(result).toEqual({
      question: 'Explain VPC peering.',
      options: [],
      answerKey: '',
      format: null,
      supportingSpans: [],
      sourceChunkIds: [],
    })
  })

  it('sets format to null when the stored format is not a valid QuestionFormat', () => {
    const result = mapGeneratedContent({
      item: {
        question: 'What does Amazon EC2 provide?',
        options: ['Scalable computing capacity'],
        correctAnswer: 'Scalable computing capacity',
        supportingSpans: [],
        sourceChunkIds: [],
      },
      format: 'not_a_real_format',
    })

    expect(result?.format).toBeNull()
  })

  it('defaults array fields to [] and answerKey to "" when the stored values are not string arrays / strings', () => {
    const result = mapGeneratedContent({
      item: {
        question: 'Q',
        options: ['a', 2, 'b'],
        correctAnswer: 42,
        supportingSpans: ['span', null],
        sourceChunkIds: 'not-an-array',
      },
    })

    expect(result).toEqual({
      question: 'Q',
      options: [],
      answerKey: '',
      format: null,
      supportingSpans: [],
      sourceChunkIds: [],
    })
  })
})
