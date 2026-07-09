import { describe, expect, it } from 'vitest'
import { splitParagraphs } from '~/composables/agentMessages'

describe('splitParagraphs', () => {
  it('returns an empty array for empty or whitespace-only content', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs('   \n  ')).toEqual([])
  })

  it('returns a single paragraph for content with no blank-line breaks', () => {
    expect(splitParagraphs('Service Control Policies are guardrails.')).toEqual([
      'Service Control Policies are guardrails.',
    ])
  })

  it('splits on blank lines into discrete, trimmed paragraphs', () => {
    const content =
      'First paragraph explains the concept.\n\nSecond paragraph gives an example.\n\nThird paragraph wraps up.'

    expect(splitParagraphs(content)).toEqual([
      'First paragraph explains the concept.',
      'Second paragraph gives an example.',
      'Third paragraph wraps up.',
    ])
  })

  it('collapses multiple consecutive blank lines into a single paragraph break', () => {
    const content = 'Paragraph one.\n\n\n\nParagraph two.'
    expect(splitParagraphs(content)).toEqual(['Paragraph one.', 'Paragraph two.'])
  })
})
