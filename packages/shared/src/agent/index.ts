import { z } from 'zod'

export const agentConversationModes = ['in_session', 'standalone'] as const
export type AgentConversationMode = (typeof agentConversationModes)[number]

export const agentMessageRoles = ['user', 'assistant', 'tool', 'system'] as const
export type AgentMessageRole = (typeof agentMessageRoles)[number]

export type AgentMessageContentPart = Record<string, unknown>
export type AgentMessageContent = string | AgentMessageContentPart[]

export const agentMessageRequestSchema = z.object({
  content: z.string().min(1),
})
export type AgentMessageRequest = z.infer<typeof agentMessageRequestSchema>

export interface AgentConversationResponse {
  id: string
  mode: AgentConversationMode
  studySessionId: string | null
  certificationId: string | null
  lastActivityAt: string
  createdAt: string
}

export interface AgentMessageResponse {
  role: AgentMessageRole
  content: AgentMessageContent
  createdAt: string
}
