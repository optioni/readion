import { defineEntity, p } from '@mikro-orm/core'
import type { AgentMessageContent, AgentMessageRole } from '@readion/shared'
import { agentMessageRoles } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const AgentMessageSchema = defineEntity({
  name: 'AgentMessage',
  tableName: 'agent_messages',
  extends: BaseSchema,
  properties: {
    conversationId: p.uuid(),
    role: p.enum([...agentMessageRoles]),
    content: p.json<AgentMessageContent>(),
  },
})

export class AgentMessage extends AgentMessageSchema.class {
  override id: string = v4()
  override conversationId!: string
  override role!: AgentMessageRole
  override content!: AgentMessageContent
}

AgentMessageSchema.setClass(AgentMessage)
