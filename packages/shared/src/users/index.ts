import { z } from 'zod'
import { authUserSchema } from '../auth'

export const DEFAULT_DISPLAY_TIMEZONE = 'Europe/Helsinki'

export const sessionDefaultDurations = [15, 30, 60, 90] as const
export const sessionDefaultContentMixes = ['balanced', 'reading-heavy', 'quiz-heavy'] as const
export const sessionDefaultDifficulties = [
  'beginner',
  'intermediate',
  'advanced',
  'adaptive',
] as const
export const sessionDefaultFocusAreas = ['auto', 'weak-areas', 'new-material', 'review'] as const
export const sessionDefaultLearningStyles = [
  'weak-area-focus',
  'spaced-repetition',
  'scenario-based',
] as const

export const DEFAULT_SESSION_DEFAULTS = {
  duration: 30,
  contentMix: 'balanced',
  difficulty: 'intermediate',
  focusArea: 'auto',
  learningStyle: 'weak-area-focus',
} as const

const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'))

export function isSupportedTimeZone(value: string) {
  return supportedTimeZones.has(value)
}

export const displayTimezoneSchema = z.string().refine(isSupportedTimeZone, {
  message: 'Must be a valid IANA timezone',
})

export const sessionDefaultsSchema = z.object({
  duration: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
  contentMix: z.enum(sessionDefaultContentMixes),
  difficulty: z.enum(sessionDefaultDifficulties),
  focusArea: z.enum(sessionDefaultFocusAreas),
  learningStyle: z.enum(sessionDefaultLearningStyles),
})

export const userProfileResponseSchema = authUserSchema.extend({
  displayTimezone: displayTimezoneSchema,
  sessionDefaults: sessionDefaultsSchema,
})

export const updateUserProfileRequestSchema = z.object({
  displayTimezone: displayTimezoneSchema.optional(),
  sessionDefaults: sessionDefaultsSchema.partial().optional(),
})

export type SessionDefaults = z.infer<typeof sessionDefaultsSchema>
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileRequestSchema>
