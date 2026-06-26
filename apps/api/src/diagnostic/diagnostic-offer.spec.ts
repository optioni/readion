import { describe, expect, it } from 'vitest'
import { deriveOffer } from './diagnostic-offer'

describe('deriveOffer', () => {
  it('returns none when cert is not live', () => {
    expect(
      deriveOffer({
        certLive: false,
        hasCompletedDiagnostic: false,
        completedSessionCount: 0,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('none')
  })

  it('returns onboarding when cert is live and no completed diagnostic', () => {
    expect(
      deriveOffer({
        certLive: true,
        hasCompletedDiagnostic: false,
        completedSessionCount: 5,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('onboarding')
  })

  it('returns none when has completed diagnostic but session count is below threshold', () => {
    expect(
      deriveOffer({
        certLive: true,
        hasCompletedDiagnostic: true,
        completedSessionCount: 0,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('none')
  })

  it('returns re-prompt when has completed diagnostic, count >= threshold, and not yet dismissed', () => {
    expect(
      deriveOffer({
        certLive: true,
        hasCompletedDiagnostic: true,
        completedSessionCount: 1,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('re-prompt')
  })

  it('returns none when has completed diagnostic, count >= threshold, but already dismissed', () => {
    expect(
      deriveOffer({
        certLive: true,
        hasCompletedDiagnostic: true,
        completedSessionCount: 3,
        repromptAfterSessions: 1,
        diagnosticRePromptedAt: new Date('2024-01-01'),
      }),
    ).toBe('none')
  })

  it('returns re-prompt when repromptAfterSessions is 0 and count is 0 and not dismissed', () => {
    expect(
      deriveOffer({
        certLive: true,
        hasCompletedDiagnostic: true,
        completedSessionCount: 0,
        repromptAfterSessions: 0,
        diagnosticRePromptedAt: null,
      }),
    ).toBe('re-prompt')
  })
})
