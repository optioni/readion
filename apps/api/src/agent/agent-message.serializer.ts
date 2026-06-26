import type { AgentMessageContent, AgentMessageContentPart, AgentMessageRole } from '@readion/shared'
import type { AssistantContent, ModelMessage, ToolContent, UserContent } from 'ai'

export type AgentMessageRowData = {
  role: AgentMessageRole
  content: AgentMessageContent
}

function serializeContent(content: ModelMessage['content']): AgentMessageContent {
  if (typeof content === 'string') {
    return content
  }

  return content.map((part): AgentMessageContentPart => ({ ...part }))
}

export function serializeModelMessage(message: ModelMessage): AgentMessageRowData {
  return {
    role: message.role,
    content: serializeContent(message.content),
  }
}

export function deserializeMessageRow(row: AgentMessageRowData): ModelMessage {
  switch (row.role) {
    case 'system':
      return { role: 'system', content: asStringContent(row.content) }
    case 'user':
      return { role: 'user', content: row.content as UserContent }
    case 'assistant':
      return { role: 'assistant', content: row.content as AssistantContent }
    case 'tool':
      return { role: 'tool', content: row.content as ToolContent }
  }
}

export function buildReplayMessages(rows: AgentMessageRowData[]): ModelMessage[] {
  return rows.map(deserializeMessageRow)
}

function asStringContent(content: AgentMessageContent): string {
  return typeof content === 'string' ? content : ''
}
