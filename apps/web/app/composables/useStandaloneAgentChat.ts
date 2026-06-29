import type { AgentMessageResponse } from '@readion/shared'
import { onMounted, reactive, ref } from 'vue'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import { type AgentPanelMessage, hydrateAgentMessages } from '~/composables/agentMessages'
import { fetchAgentConversation } from '~/composables/sessionViewApi'
import {
  type AgentStreamEvent,
  extractTextDelta,
  useAgentTurnStream,
} from '~/composables/useAgentTurnStream'

function handleEvent(assistant: AgentPanelMessage, event: AgentStreamEvent): void {
  if (event.type === 'text-delta') {
    const delta = extractTextDelta(event)
    if (delta !== null) {
      assistant.content += delta
    }
    return
  }
  if (event.type === 'error') {
    assistant.error = String(event.error)
  }
}

export function useStandaloneAgentChat() {
  const conversationId = ref<string | null>(null)
  const messages = ref<AgentPanelMessage[]>([])
  const isStreaming = ref(false)
  const lastActivityAt = ref<string | null>(null)

  async function initConversation(): Promise<void> {
    const created = await createStandaloneAgentConversation()
    const id = created.data.id
    conversationId.value = id
    lastActivityAt.value = created.data.lastActivityAt

    const detail = await fetchAgentConversation(id)
    const raw = (detail.relationships?.messages?.data ?? []) as AgentMessageResponse[]
    messages.value = hydrateAgentMessages(raw)
  }

  async function send(content: string): Promise<void> {
    const trimmed = content.trim()
    if (trimmed.length === 0 || isStreaming.value || conversationId.value === null) {
      return
    }

    const id = conversationId.value
    const { streamTurn } = useAgentTurnStream()

    messages.value.push({ role: 'user', content: trimmed, toolResults: [], error: null })

    const assistant = reactive<AgentPanelMessage>({
      role: 'assistant',
      content: '',
      toolResults: [],
      error: null,
    })
    messages.value.push(assistant)

    isStreaming.value = true
    lastActivityAt.value = new Date().toISOString()

    try {
      await streamTurn(id, trimmed, (event) => handleEvent(assistant, event))
    } finally {
      isStreaming.value = false
    }
  }

  async function newChat(): Promise<void> {
    conversationId.value = null
    messages.value = []
    lastActivityAt.value = null
    await initConversation()
  }

  onMounted(() => {
    void initConversation()
  })

  return {
    conversationId,
    messages,
    isStreaming,
    lastActivityAt,
    send,
    newChat,
  }
}
