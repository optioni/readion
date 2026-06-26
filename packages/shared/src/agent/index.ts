export const agentConversationModes = ['in_session', 'standalone'] as const
export type AgentConversationMode = (typeof agentConversationModes)[number]

export const agentMessageRoles = ['user', 'assistant', 'tool', 'system'] as const
export type AgentMessageRole = (typeof agentMessageRoles)[number]

export type AgentMessageContentPart = Record<string, unknown>
export type AgentMessageContent = string | AgentMessageContentPart[]
