export type VerbatimCapOk = { violation: false }
export type VerbatimCapViolation = { violation: true; excess: number }
export type VerbatimCapResult = VerbatimCapOk | VerbatimCapViolation

export function checkVerbatimCap(spans: string[], cap: number): VerbatimCapResult {
  const total = spans.reduce((sum, span) => sum + span.length, 0)
  if (total <= cap) {
    return { violation: false }
  }
  return { violation: true, excess: total - cap }
}
