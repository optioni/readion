import type { SessionResponse } from '../sessions'

export interface SessionSummaryDomainStat {
  domain: string
  accuracy: number
}

export interface WeakAreaDelta {
  domain: string
  delta: number
}

export interface SessionReadinessChange {
  before: number | null
  after: number | null
  delta: number | null
}

export interface SessionQuestionRef {
  responseId: string
  question: string
}

export interface SessionSummaryResponse {
  questionsAnswered: number
  accuracy: number
  domains: SessionSummaryDomainStat[]
  weakAreaDeltas: WeakAreaDelta[]
  readiness: SessionReadinessChange
  strongestQuestion: SessionQuestionRef | null
  weakestQuestion: SessionQuestionRef | null
  nextFocus: { domain: string } | null
}

export type DrillResultResponse =
  | { status: 'started'; session: SessionResponse }
  | { status: 'no_misses' }

export const SUMMARY_DRILL_MAX_QUESTIONS = 7

export const SUMMARY_UNSURE_CONFIDENCE_THRESHOLD = 2
