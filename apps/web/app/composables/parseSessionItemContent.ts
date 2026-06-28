import type { QuestionFormat, SessionItemResponse } from '@readion/shared'

export type ParsedSessionItem =
  | { kind: 'reading'; markdown: string }
  | { kind: 'video'; content: string }
  | {
      kind: 'quiz'
      questionId: string
      question: string
      options: string[]
      format: QuestionFormat
    }
  | { kind: 'insufficient'; domain: string }
  | { kind: 'invalid' }

function parseQuizContent(content: string): ParsedSessionItem {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    return { kind: 'invalid' }
  }
  if (!data || typeof data !== 'object') {
    return { kind: 'invalid' }
  }
  const record = data as Record<string, unknown>
  if (record.insufficient === true && typeof record.domain === 'string') {
    return { kind: 'insufficient', domain: record.domain }
  }
  if (
    typeof record.questionId === 'string' &&
    typeof record.question === 'string' &&
    Array.isArray(record.options) &&
    record.options.every((option) => typeof option === 'string')
  ) {
    return {
      kind: 'quiz',
      questionId: record.questionId,
      question: record.question,
      options: record.options as string[],
      format:
        typeof record.format === 'string' ? (record.format as QuestionFormat) : 'multiple_choice',
    }
  }
  return { kind: 'invalid' }
}

export function parseSessionItemContent(item: SessionItemResponse): ParsedSessionItem {
  if (item.type === 'reading') {
    return { kind: 'reading', markdown: item.content }
  }
  if (item.type === 'video') {
    return { kind: 'video', content: item.content }
  }
  return parseQuizContent(item.content)
}
