import type { MockExamQuestionResponse } from '@readion/shared'
import { computed, ref } from 'vue'
import { saveMockExamAnswer } from '~/composables/mockExamApi'

export function seedAnswers(
  questions: Pick<MockExamQuestionResponse, 'userAnswer'>[],
): Map<number, string> {
  const answers = new Map<number, string>()
  questions.forEach((question, index) => {
    if (question.userAnswer !== null && question.userAnswer !== undefined) {
      answers.set(index, question.userAnswer)
    }
  })
  return answers
}

export function useMockExamAnswers(
  examId: string,
  questions: Pick<MockExamQuestionResponse, 'userAnswer'>[],
) {
  const answers = ref<Map<number, string>>(seedAnswers(questions))

  const answeredIndices = computed<number[]>(() => [...answers.value.keys()])

  function answerFor(index: number): string | undefined {
    return answers.value.get(index)
  }

  // Optimistically record the answer so the nav square and option highlight update before the
  // round-trip; the PUT path carries the zero-based index, overwriting any prior answer there.
  async function recordAnswer(index: number, answer: string): Promise<void> {
    const next = new Map(answers.value)
    next.set(index, answer)
    answers.value = next
    await saveMockExamAnswer(examId, index, { answer })
  }

  return { answers, answeredIndices, answerFor, recordAnswer }
}
