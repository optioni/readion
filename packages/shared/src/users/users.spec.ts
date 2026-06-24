import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  DEFAULT_SESSION_DEFAULTS,
  type SessionDefaults,
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
  type UpdateUserProfileRequest,
  type UserProfileResponse,
  updateUserProfileRequestSchema,
  userProfileResponseSchema,
} from './index'

describe('users shared contracts', () => {
  it('exports session-default option sets and neutral defaults', () => {
    expect(sessionDefaultDurations).toEqual([15, 30, 60, 90])
    expect(sessionDefaultContentMixes).toEqual(['balanced', 'reading-heavy', 'quiz-heavy'])
    expect(sessionDefaultDifficulties).toEqual(['beginner', 'intermediate', 'advanced', 'adaptive'])
    expect(sessionDefaultFocusAreas).toEqual(['auto', 'weak-areas', 'new-material', 'review'])
    expect(sessionDefaultLearningStyles).toEqual([
      'weak-area-focus',
      'spaced-repetition',
      'scenario-based',
    ])
    expect(DEFAULT_SESSION_DEFAULTS).toEqual({
      duration: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: 'auto',
      learningStyle: 'weak-area-focus',
    })
    expectTypeOf<SessionDefaults>().toEqualTypeOf<typeof DEFAULT_SESSION_DEFAULTS>()
  })

  it('validates profile responses without password fields', () => {
    const profile = userProfileResponseSchema.parse({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'admin',
      emailVerified: true,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults: DEFAULT_SESSION_DEFAULTS,
    })

    expect(profile.email).toBe('ada@example.com')
    expect(profile).not.toHaveProperty('password')
    expect(profile).not.toHaveProperty('passwordHash')
    expectTypeOf<UserProfileResponse>().not.toHaveProperty('passwordHash')
  })

  it('validates partial profile updates and strips immutable fields', () => {
    const update = updateUserProfileRequestSchema.parse({
      email: 'new@example.com',
      role: 'admin',
      emailVerified: false,
      passwordHash: 'secret',
      displayTimezone: 'America/New_York',
      sessionDefaults: {
        duration: 60,
        learningStyle: 'spaced-repetition',
      },
    })

    expect(update).toEqual({
      displayTimezone: 'America/New_York',
      sessionDefaults: {
        duration: 60,
        learningStyle: 'spaced-repetition',
      },
    })
    expectTypeOf<UpdateUserProfileRequest>().not.toHaveProperty('email')
  })

  it('rejects invalid IANA timezones and out-of-set preference values', () => {
    expect(
      updateUserProfileRequestSchema.safeParse({ displayTimezone: 'Mars/Olympus' }).success,
    ).toBe(false)
    expect(
      updateUserProfileRequestSchema.safeParse({ sessionDefaults: { duration: 45 } }).success,
    ).toBe(false)
    expect(
      updateUserProfileRequestSchema.safeParse({
        sessionDefaults: { contentMix: 'flashcards-only' },
      }).success,
    ).toBe(false)
  })
})
