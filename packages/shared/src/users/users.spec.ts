import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  DEFAULT_SESSION_DEFAULTS,
  type SessionDefaults,
  sessionDefaultContentMixes,
  sessionDefaultContentMixLabels,
  sessionDefaultDifficulties,
  sessionDefaultDifficultyLabels,
  sessionDefaultDurations,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyleLabels,
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
      digestOptOut: false,
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

  it('includes digestOptOut in profile responses', () => {
    const profile = userProfileResponseSchema.parse({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'admin',
      emailVerified: true,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults: DEFAULT_SESSION_DEFAULTS,
      digestOptOut: true,
    })

    expect(profile.digestOptOut).toBe(true)
    expectTypeOf<UserProfileResponse>().toHaveProperty('digestOptOut').toEqualTypeOf<boolean>()
  })

  it('requires digestOptOut to be present in profile responses', () => {
    expect(
      userProfileResponseSchema.safeParse({
        id: 'user-1',
        email: 'ada@example.com',
        role: 'admin',
        emailVerified: true,
        displayTimezone: 'Europe/Helsinki',
        sessionDefaults: DEFAULT_SESSION_DEFAULTS,
      }).success,
    ).toBe(false)
  })

  it('accepts optional digestOptOut in profile updates', () => {
    expect(updateUserProfileRequestSchema.parse({ digestOptOut: true })).toEqual({
      digestOptOut: true,
    })
    expect(updateUserProfileRequestSchema.parse({}).digestOptOut).toBeUndefined()
    expect(updateUserProfileRequestSchema.safeParse({ digestOptOut: 'yes' }).success).toBe(false)
  })

  it('maps every difficulty/content-mix/learning-style enum value to a human-readable label', () => {
    for (const value of sessionDefaultDifficulties) {
      expect(sessionDefaultDifficultyLabels[value]).toEqual(expect.any(String))
      expect(sessionDefaultDifficultyLabels[value]).not.toBe(value)
    }
    expect(sessionDefaultDifficultyLabels).toEqual({
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      adaptive: 'Adaptive',
    })

    for (const value of sessionDefaultContentMixes) {
      expect(sessionDefaultContentMixLabels[value]).toEqual(expect.any(String))
      expect(sessionDefaultContentMixLabels[value]).not.toBe(value)
    }
    expect(sessionDefaultContentMixLabels).toEqual({
      balanced: 'Balanced',
      'reading-heavy': 'Reading-heavy',
      'quiz-heavy': 'Quiz-heavy',
    })

    for (const value of sessionDefaultLearningStyles) {
      expect(sessionDefaultLearningStyleLabels[value]).toEqual(expect.any(String))
      expect(sessionDefaultLearningStyleLabels[value]).not.toBe(value)
    }
    expect(sessionDefaultLearningStyleLabels).toEqual({
      'weak-area-focus': 'Weak-area focus',
      'spaced-repetition': 'Spaced repetition',
      'scenario-based': 'Scenario-based',
    })
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
