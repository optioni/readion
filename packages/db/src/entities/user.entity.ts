import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import {
  DEFAULT_DISPLAY_TIMEZONE,
  DEFAULT_SESSION_DEFAULTS,
  type SessionDefaults,
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
} from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const UserRole = {
  User: 'user',
  Admin: 'admin',
} as const

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole]

export const UserSchema = defineEntity({
  name: 'User',
  tableName: 'users',
  extends: BaseSchema,
  properties: {
    email: p.string(),
    passwordHash: p.string(),
    emailVerified: p.boolean().default(false),
    role: p.enum([UserRole.User, UserRole.Admin]).default(UserRole.User),
    displayTimezone: p.string().default(DEFAULT_DISPLAY_TIMEZONE),
    sessionDefaultDuration: p.integer().default(DEFAULT_SESSION_DEFAULTS.duration),
    sessionDefaultContentMix: p
      .enum([...sessionDefaultContentMixes])
      .default(DEFAULT_SESSION_DEFAULTS.contentMix),
    sessionDefaultDifficulty: p
      .enum([...sessionDefaultDifficulties])
      .default(DEFAULT_SESSION_DEFAULTS.difficulty),
    sessionDefaultFocusArea: p
      .enum([...sessionDefaultFocusAreas])
      .default(DEFAULT_SESSION_DEFAULTS.focusArea),
    sessionDefaultLearningStyle: p
      .enum([...sessionDefaultLearningStyles])
      .default(DEFAULT_SESSION_DEFAULTS.learningStyle),
    deletedAt: p.datetime().nullable(),
  },
})

export class User extends UserSchema.class {
  [OptionalProps]?:
    | 'emailVerified'
    | 'role'
    | 'displayTimezone'
    | 'sessionDefaultDuration'
    | 'sessionDefaultContentMix'
    | 'sessionDefaultDifficulty'
    | 'sessionDefaultFocusArea'
    | 'sessionDefaultLearningStyle'

  override id: string = v4()
  override email!: string
  override passwordHash!: string
  override emailVerified: boolean = false
  override role: UserRoleValue = UserRole.User
  override displayTimezone: string = DEFAULT_DISPLAY_TIMEZONE
  override sessionDefaultDuration: SessionDefaults['duration'] = DEFAULT_SESSION_DEFAULTS.duration
  override sessionDefaultContentMix: SessionDefaults['contentMix'] =
    DEFAULT_SESSION_DEFAULTS.contentMix
  override sessionDefaultDifficulty: SessionDefaults['difficulty'] =
    DEFAULT_SESSION_DEFAULTS.difficulty
  override sessionDefaultFocusArea: SessionDefaults['focusArea'] =
    DEFAULT_SESSION_DEFAULTS.focusArea
  override sessionDefaultLearningStyle: SessionDefaults['learningStyle'] =
    DEFAULT_SESSION_DEFAULTS.learningStyle
  override deletedAt: Date | null = null
}

UserSchema.setClass(User)
