export interface AnswerableQuestion {
  userAnswer?: string | null
}

export function displayNumber(index: number): number {
  return index + 1
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

// Answers are persisted by zero-based array index; resume opens at the first question the server has
// not recorded an answer for, falling back to the first question when every answer is present.
export function firstUnansweredIndex(questions: AnswerableQuestion[]): number {
  const index = questions.findIndex(
    (question) => question.userAnswer === null || question.userAnswer === undefined,
  )
  return index >= 0 ? index : 0
}
