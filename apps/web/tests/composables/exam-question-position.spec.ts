import { describe, expect, it } from 'vitest'
import {
  displayNumber,
  firstUnansweredIndex,
  optionLetter,
} from '~/composables/examQuestionPosition'

describe('displayNumber', () => {
  it('maps a zero-based index to a 1-based question number', () => {
    expect(displayNumber(0)).toBe(1)
    expect(displayNumber(64)).toBe(65)
  })
})

describe('optionLetter', () => {
  it('maps a zero-based index to its option letter', () => {
    expect(optionLetter(0)).toBe('A')
    expect(optionLetter(1)).toBe('B')
    expect(optionLetter(3)).toBe('D')
  })
})

describe('firstUnansweredIndex', () => {
  it('returns the index of the first question with a null answer', () => {
    const questions = [
      { userAnswer: 'a' },
      { userAnswer: 'b' },
      { userAnswer: null },
      { userAnswer: null },
    ]
    expect(firstUnansweredIndex(questions)).toBe(2)
  })

  it('treats an undefined answer as unanswered', () => {
    expect(firstUnansweredIndex([{ userAnswer: 'a' }, { userAnswer: undefined }])).toBe(1)
  })

  it('falls back to the first question when every answer is present', () => {
    expect(firstUnansweredIndex([{ userAnswer: 'a' }, { userAnswer: 'b' }])).toBe(0)
  })

  it('returns zero for an empty question list', () => {
    expect(firstUnansweredIndex([])).toBe(0)
  })
})
