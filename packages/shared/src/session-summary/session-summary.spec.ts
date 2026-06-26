import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  DrillResultResponse,
  SessionQuestionRef,
  SessionReadinessChange,
  SessionSummaryDomainStat,
  SessionSummaryResponse,
  WeakAreaDelta,
} from './index'
import { SUMMARY_DRILL_MAX_QUESTIONS, SUMMARY_UNSURE_CONFIDENCE_THRESHOLD } from './index'

describe('session-summary contracts', () => {
  describe('SessionSummaryDomainStat', () => {
    it('has domain and accuracy fields', () => {
      const stat: SessionSummaryDomainStat = { domain: 'Networking', accuracy: 0.75 }
      expectTypeOf(stat.domain).toEqualTypeOf<string>()
      expectTypeOf(stat.accuracy).toEqualTypeOf<number>()
    })
  })

  describe('WeakAreaDelta', () => {
    it('has domain and delta fields', () => {
      const delta: WeakAreaDelta = { domain: 'Security', delta: -5 }
      expectTypeOf(delta.domain).toEqualTypeOf<string>()
      expectTypeOf(delta.delta).toEqualTypeOf<number>()
    })
  })

  describe('SessionReadinessChange', () => {
    it('has nullable before/after/delta fields', () => {
      const change: SessionReadinessChange = { before: 60, after: null, delta: null }
      expectTypeOf(change.before).toEqualTypeOf<number | null>()
      expectTypeOf(change.after).toEqualTypeOf<number | null>()
      expectTypeOf(change.delta).toEqualTypeOf<number | null>()
    })

    it('accepts all non-null values', () => {
      const change: SessionReadinessChange = { before: 60, after: 65, delta: 5 }
      expectTypeOf(change.before).toEqualTypeOf<number | null>()
      expectTypeOf(change.after).toEqualTypeOf<number | null>()
      expectTypeOf(change.delta).toEqualTypeOf<number | null>()
    })
  })

  describe('SessionQuestionRef', () => {
    it('has responseId and question fields', () => {
      const ref: SessionQuestionRef = { responseId: 'abc-123', question: 'What is IAM?' }
      expectTypeOf(ref.responseId).toEqualTypeOf<string>()
      expectTypeOf(ref.question).toEqualTypeOf<string>()
    })
  })

  describe('SessionSummaryResponse', () => {
    it('has all required fields with correct types', () => {
      const summary: SessionSummaryResponse = {
        questionsAnswered: 10,
        accuracy: 0.8,
        domains: [{ domain: 'Networking', accuracy: 0.75 }],
        weakAreaDeltas: [{ domain: 'Security', delta: -5 }],
        readiness: { before: 60, after: 65, delta: 5 },
        strongestQuestion: { responseId: 'r1', question: 'What is VPC?' },
        weakestQuestion: null,
        nextFocus: { domain: 'IAM' },
      }
      expectTypeOf(summary.questionsAnswered).toEqualTypeOf<number>()
      expectTypeOf(summary.accuracy).toEqualTypeOf<number>()
      expectTypeOf(summary.domains).toEqualTypeOf<SessionSummaryDomainStat[]>()
      expectTypeOf(summary.weakAreaDeltas).toEqualTypeOf<WeakAreaDelta[]>()
      expectTypeOf(summary.readiness).toEqualTypeOf<SessionReadinessChange>()
      expectTypeOf(summary.strongestQuestion).toEqualTypeOf<SessionQuestionRef | null>()
      expectTypeOf(summary.weakestQuestion).toEqualTypeOf<SessionQuestionRef | null>()
      expectTypeOf(summary.nextFocus).toEqualTypeOf<{ domain: string } | null>()
    })

    it('accepts null nullable fields', () => {
      const summary: SessionSummaryResponse = {
        questionsAnswered: 0,
        accuracy: 0,
        domains: [],
        weakAreaDeltas: [],
        readiness: { before: null, after: null, delta: null },
        strongestQuestion: null,
        weakestQuestion: null,
        nextFocus: null,
      }
      expect(summary.strongestQuestion).toBeNull()
      expect(summary.weakestQuestion).toBeNull()
      expect(summary.nextFocus).toBeNull()
    })
  })

  describe('DrillResultResponse', () => {
    it('is a discriminated union on status', () => {
      expectTypeOf<DrillResultResponse>().toMatchTypeOf<{ status: 'started' | 'no_misses' }>()
    })

    it('started variant has a session field', () => {
      type StartedDrill = Extract<DrillResultResponse, { status: 'started' }>
      expectTypeOf<StartedDrill['session']>().not.toBeUndefined()
    })

    it('no_misses variant has no session field', () => {
      type NoMissesDrill = Extract<DrillResultResponse, { status: 'no_misses' }>
      expectTypeOf<NoMissesDrill>().toMatchTypeOf<{ status: 'no_misses' }>()
    })
  })

  describe('constants', () => {
    it('SUMMARY_DRILL_MAX_QUESTIONS is 7', () => {
      expect(SUMMARY_DRILL_MAX_QUESTIONS).toBe(7)
    })

    it('SUMMARY_UNSURE_CONFIDENCE_THRESHOLD is 2', () => {
      expect(SUMMARY_UNSURE_CONFIDENCE_THRESHOLD).toBe(2)
    })
  })
})
