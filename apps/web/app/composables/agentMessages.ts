import type { AgentMessageContent, AgentMessageResponse } from '@readion/shared'

export type AgentToolResultPart = {
  id: string
  toolName: string
  output: unknown
}

export type AgentPanelMessage = {
  role: 'user' | 'assistant'
  content: string
  toolResults: AgentToolResultPart[]
  error: string | null
}

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    (part as { type?: unknown }).type === 'text' &&
    typeof (part as { text?: unknown }).text === 'string'
  )
}

export function extractMessageText(content: AgentMessageContent): string {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join('')
}

export function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

export function hydrateAgentMessages(raw: AgentMessageResponse[]): AgentPanelMessage[] {
  const messages: AgentPanelMessage[] = []
  for (const message of raw) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue
    }
    const text = extractMessageText(message.content)
    if (text.length === 0) {
      continue
    }
    messages.push({ role: message.role, content: text, toolResults: [], error: null })
  }
  return messages
}
