import type { QuizOptionState } from '~/components/QuizOption.vue'

// Shared option-state derivation for both exam scenes. The active scene passes no `correctAnswer`, so
// nothing is revealed (only rest/selected); the review scene passes it to reveal correct/incorrect/dim.
export function optionRevealState(
  option: string,
  userAnswer: string | null | undefined,
  correctAnswer?: string | null,
): QuizOptionState {
  if (correctAnswer == null) {
    return option === userAnswer ? 'selected' : 'rest'
  }
  if (option === correctAnswer) {
    return 'correct'
  }
  if (userAnswer != null && option === userAnswer) {
    return 'incorrect'
  }
  return 'dim'
}
