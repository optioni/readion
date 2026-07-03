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
