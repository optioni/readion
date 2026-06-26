export function reviewQualifies(
  answer: { correct: boolean; confidence: number },
  unsureThreshold = 2,
): boolean {
  return !answer.correct || answer.confidence <= unsureThreshold
}
