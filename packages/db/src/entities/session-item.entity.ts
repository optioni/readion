import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { SessionItemType } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'
import { StudySession, StudySessionSchema } from './study-session.entity'

export const SessionItemSchema = defineEntity({
  name: 'SessionItem',
  tableName: 'session_items',
  extends: BaseSchema,
  properties: {
    session: p.manyToOne(StudySessionSchema).joinColumn('session_id'),
    index: p.integer(),
    type: p.enum(['reading', 'quiz', 'video']),
    domain: p.string().default(''),
    content: p.text(),
    completed: p.boolean().default(false),
    sourceChunkIds: p.json<string[]>(),
    supportingSpans: p.json<string[]>(),
  },
})

export class SessionItem extends SessionItemSchema.class {
  [OptionalProps]?: 'completed' | 'domain'

  override id: string = v4()
  override session!: StudySession
  override index!: number
  override type!: SessionItemType
  override domain: string = ''
  override content!: string
  override completed: boolean = false
  override sourceChunkIds!: string[]
  override supportingSpans!: string[]
}

SessionItemSchema.setClass(SessionItem)
