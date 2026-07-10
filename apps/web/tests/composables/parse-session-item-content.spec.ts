import type { SessionItemResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { parseSessionItemContent } from '~/composables/parseSessionItemContent'

function item(overrides: Partial<SessionItemResponse>): SessionItemResponse {
  return {
    index: 0,
    type: 'reading',
    domain: '',
    content: '',
    completed: false,
    sourceChunkIds: [],
    supportingSpans: [],
    ...overrides,
  }
}

describe('parseSessionItemContent reading', () => {
  it('returns the raw markdown for a reading item', () => {
    const parsed = parseSessionItemContent(item({ type: 'reading', content: '## Hello\n\nWorld' }))
    expect(parsed).toEqual({ kind: 'reading', markdown: '## Hello\n\nWorld' })
  })
})

describe('parseSessionItemContent quiz', () => {
  it('parses a quiz item whose content is a JSON string with string options', () => {
    const content = JSON.stringify({
      questionId: 'q-1',
      question: 'Which feature enforces guardrails?',
      options: ['IAM boundaries', 'Service Control Policies', 'Session policies'],
      format: 'multiple_choice',
    })

    const parsed = parseSessionItemContent(item({ type: 'quiz', content }))

    expect(parsed).toEqual({
      kind: 'quiz',
      questionId: 'q-1',
      question: 'Which feature enforces guardrails?',
      options: ['IAM boundaries', 'Service Control Policies', 'Session policies'],
      format: 'multiple_choice',
    })
  })

  it('parses an insufficient-material quiz item', () => {
    const content = JSON.stringify({ insufficient: true, domain: 'Cost-Optimized Architectures' })

    const parsed = parseSessionItemContent(item({ type: 'quiz', content }))

    expect(parsed).toEqual({ kind: 'insufficient', domain: 'Cost-Optimized Architectures' })
  })

  it('returns an invalid result for non-JSON quiz content', () => {
    const parsed = parseSessionItemContent(item({ type: 'quiz', content: 'not json {' }))
    expect(parsed).toEqual({ kind: 'invalid' })
  })

  it('returns an invalid result when the quiz JSON is missing required fields', () => {
    const parsed = parseSessionItemContent(
      item({ type: 'quiz', content: JSON.stringify({ question: 'no id or options' }) }),
    )
    expect(parsed).toEqual({ kind: 'invalid' })
  })
})

describe('parseSessionItemContent video', () => {
  it('returns the content for a video item', () => {
    const parsed = parseSessionItemContent(item({ type: 'video', content: 'https://vid' }))
    expect(parsed).toEqual({ kind: 'video', content: 'https://vid' })
  })
})
