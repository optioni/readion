import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { EnrollmentStatus, SessionDefaults } from '@readion/shared'
import {
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
} from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { Certification, CertificationSchema } from './certification.entity'
import { User, UserSchema } from './user.entity'

export const userCertificationStatuses = ['active', 'archived'] as const

export const UserCertificationSchema = defineEntity({
  name: 'UserCertification',
  tableName: 'user_certifications',
  extends: BaseSchema,
  properties: {
    user: p.manyToOne(UserSchema).joinColumn('user_id'),
    certification: p.manyToOne(CertificationSchema).joinColumn('certification_id'),
    status: p.enum([...userCertificationStatuses]).default('active'),
    enrolledAt: p.datetime().onCreate(() => new Date()),
    sessionOverrideDuration: p.integer().nullable(),
    sessionOverrideContentMix: p.enum([...sessionDefaultContentMixes]).nullable(),
    sessionOverrideDifficulty: p.enum([...sessionDefaultDifficulties]).nullable(),
    sessionOverrideFocusArea: p.enum([...sessionDefaultFocusAreas]).nullable(),
    sessionOverrideLearningStyle: p.enum([...sessionDefaultLearningStyles]).nullable(),
    diagnosticRePromptedAt: p.datetime().nullable(),
  },
})

export class UserCertification extends UserCertificationSchema.class {
  [OptionalProps]?:
    | 'status'
    | 'enrolledAt'
    | 'sessionOverrideDuration'
    | 'sessionOverrideContentMix'
    | 'sessionOverrideDifficulty'
    | 'sessionOverrideFocusArea'
    | 'sessionOverrideLearningStyle'
    | 'diagnosticRePromptedAt'

  override id: string = v4()
  override user!: User
  override certification!: Certification
  override status: EnrollmentStatus = 'active'
  override enrolledAt: Date = new Date()
  override sessionOverrideDuration: number | null = null
  override sessionOverrideContentMix: SessionDefaults['contentMix'] | null = null
  override sessionOverrideDifficulty: SessionDefaults['difficulty'] | null = null
  override sessionOverrideFocusArea: SessionDefaults['focusArea'] | null = null
  override sessionOverrideLearningStyle: SessionDefaults['learningStyle'] | null = null
  override diagnosticRePromptedAt: Date | null = null
}

UserCertificationSchema.setClass(UserCertification)
