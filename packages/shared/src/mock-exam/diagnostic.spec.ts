import { describe, expect, expectTypeOf, it } from 'vitest'
import type { DiagnosticOffer, DiagnosticOfferResponse, MockExamResponse } from './index'
import { diagnosticOffers } from './index'

describe('diagnostic offer contracts', () => {
  describe('diagnosticOffers', () => {
    it('contains onboarding, re-prompt, and none', () => {
      expect(diagnosticOffers).toContain('onboarding')
      expect(diagnosticOffers).toContain('re-prompt')
      expect(diagnosticOffers).toContain('none')
    })

    it('contains exactly three values', () => {
      expect(diagnosticOffers).toHaveLength(3)
    })
  })

  describe('DiagnosticOffer type', () => {
    it('is a union of the three offer values', () => {
      const offer: DiagnosticOffer = 'onboarding'
      expectTypeOf(offer).toEqualTypeOf<'onboarding' | 're-prompt' | 'none'>()
    })
  })

  describe('DiagnosticOfferResponse', () => {
    it('has an offer field of type DiagnosticOffer', () => {
      const response: DiagnosticOfferResponse = { offer: 're-prompt' }
      expectTypeOf(response.offer).toEqualTypeOf<DiagnosticOffer>()
    })
  })

  describe('MockExamResponse reuse for diagnostic create', () => {
    it('accepts type diagnostic with passed null', () => {
      const exam: MockExamResponse = {
        id: 'exam-1',
        userCertificationId: 'uc-1',
        type: 'diagnostic',
        status: 'in_progress',
        generation: 'ready',
        startedAt: null,
        deadline: null,
        remainingSeconds: null,
        score: null,
        passed: null,
        domainBreakdown: {},
        questions: [],
      }
      expectTypeOf(exam.passed).toEqualTypeOf<boolean | null>()
      expectTypeOf(exam.type).toEqualTypeOf<'mock' | 'diagnostic'>()
    })
  })
})
