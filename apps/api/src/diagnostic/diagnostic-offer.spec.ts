import { describe, expect, it } from 'vitest'
import { deriveOffer, type OfferParams } from './diagnostic-offer'

const BASE: OfferParams = {
  certLive: true,
  hasCompletedDiagnostic: false,
  completedSessionCount: 0,
  repromptAfterSessions: 1,
  diagnosticRePromptedAt: null,
}

describe('deriveOffer', () => {
  it('returns none when cert is not live', () => {
    expect(deriveOffer({ ...BASE, certLive: false })).toBe('none')
  })

  it('returns onboarding when cert is live, no completed diagnostic, and sessions below threshold', () => {
    expect(deriveOffer({ ...BASE, completedSessionCount: 0, repromptAfterSessions: 1 })).toBe(
      'onboarding',
    )
  })

  it('returns re-prompt when cert is live, no completed diagnostic, sessions at threshold, and not dismissed', () => {
    expect(
      deriveOffer({
        ...BASE,
        completedSessionCount: 1,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('re-prompt')
  })

  it('returns re-prompt when sessions exceed threshold and not dismissed', () => {
    expect(
      deriveOffer({
        ...BASE,
        completedSessionCount: 5,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('re-prompt')
  })

  it('returns none when dismissed (diagnosticRePromptedAt is set), even with sessions >= threshold', () => {
    expect(
      deriveOffer({
        ...BASE,
        completedSessionCount: 1,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: new Date(),
      }),
    ).toBe('none')
  })

  it('returns none when enrollment has a completed diagnostic (calibrated)', () => {
    expect(deriveOffer({ ...BASE, hasCompletedDiagnostic: true, completedSessionCount: 0 })).toBe(
      'none',
    )
  })

  it('returns none when calibrated even with many sessions', () => {
    expect(deriveOffer({ ...BASE, hasCompletedDiagnostic: true, completedSessionCount: 5 })).toBe(
      'none',
    )
  })

  it('edge case: repromptAfterSessions=0, count=0, not dismissed → re-prompt', () => {
    expect(
      deriveOffer({
        ...BASE,
        completedSessionCount: 0,
        repromptAfterSessions: 0,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('re-prompt')
  })
})
