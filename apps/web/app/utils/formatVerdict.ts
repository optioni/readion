export type VerdictTone = 'good' | 'poor'

export interface VerdictToneInfo {
  label: 'Passed' | 'Failed'
  tone: VerdictTone
}

export const VERDICT_TONES: Record<'pass' | 'fail', VerdictToneInfo> = {
  pass: { label: 'Passed', tone: 'good' },
  fail: { label: 'Failed', tone: 'poor' },
}

export interface FormatVerdictInput {
  pass: boolean
  score: number
  reason: string
}

export interface FormattedVerdict {
  label: 'Passed' | 'Failed'
  tone: VerdictTone
  scorePercent: string
  reason: string
}

export function formatVerdict(input: FormatVerdictInput): FormattedVerdict {
  const { label, tone } = VERDICT_TONES[input.pass ? 'pass' : 'fail']

  return {
    label,
    tone,
    scorePercent: `${Math.round(input.score * 100)}%`,
    reason: input.reason,
  }
}

export interface VerdictProvenanceSource {
  reason: string
  provenance: {
    score: number
    verdict?: { pass: boolean; score: number }
  }
}

/**
 * Quarantined items expose their verifier verdict nested under `provenance.verdict`, which may be
 * absent on older/partial records — fall back to a fail at `provenance.score` in that case. Shared
 * by the review queue list rows and the detail pane so both derive the same badge from the same data.
 */
export function verdictInputFromProvenance(source: VerdictProvenanceSource): FormatVerdictInput {
  return {
    pass: source.provenance.verdict?.pass ?? false,
    score: source.provenance.verdict?.score ?? source.provenance.score,
    reason: source.reason,
  }
}
