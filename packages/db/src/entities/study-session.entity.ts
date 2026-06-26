import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { SessionFocusArea, SessionKind, SessionStatus } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { User, UserSchema } from './user.entity'
import { UserCertification, UserCertificationSchema } from './user-certification.entity'

export const StudySessionSchema = defineEntity({
  name: 'StudySession',
  tableName: 'study_sessions',
  extends: BaseSchema,
  properties: {
    userCertification: p.manyToOne(UserCertificationSchema).joinColumn('user_certification_id'),
    user: p.manyToOne(UserSchema).joinColumn('user_id'),
    kind: p.enum(['study', 'review']).default('study'),
    status: p.enum(['active', 'completed', 'partial', 'abandoned']).default('active'),
    durationMinutes: p.integer(),
    contentMix: p.string(),
    difficulty: p.string(),
    focusArea: p.json<SessionFocusArea>(),
    learningStyle: p.string(),
    lastItemIndex: p.integer().default(0),
    startedAt: p.datetime(),
    endedAt: p.datetime().nullable(),
  },
})

export class StudySession extends StudySessionSchema.class {
  [OptionalProps]?: 'kind' | 'status' | 'lastItemIndex' | 'endedAt'

  override id: string = v4()
  override userCertification!: UserCertification
  override user!: User
  override kind: SessionKind = 'study'
  override status: SessionStatus = 'active'
  override durationMinutes!: number
  override contentMix!: string
  override difficulty!: string
  override focusArea!: SessionFocusArea
  override learningStyle!: string
  override lastItemIndex: number = 0
  override startedAt!: Date
  override endedAt: Date | null = null
}

StudySessionSchema.setClass(StudySession)
