import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { AgentConversationMode } from '@readion/shared'
import { agentConversationModes } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const AgentConversationSchema = defineEntity({
  name: 'AgentConversation',
  tableName: 'agent_conversations',
  extends: BaseSchema,
  properties: {
    userId: p.uuid(),
    studySessionId: p.uuid().nullable(),
    certificationId: p.uuid().nullable(),
    mode: p.enum([...agentConversationModes]),
    lastActivityAt: p.datetime(),
    deletedAt: p.datetime().nullable(),
  },
})

export class AgentConversation extends AgentConversationSchema.class {
  [OptionalProps]?: 'studySessionId' | 'certificationId' | 'deletedAt'

  override id: string = v4()
  override userId!: string
  override studySessionId: string | null = null
  override certificationId: string | null = null
  override mode!: AgentConversationMode
  override lastActivityAt!: Date
  override deletedAt: Date | null = null
}

AgentConversationSchema.setClass(AgentConversation)
