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
import { useTrack } from '~/composables/useTrack'

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
  const isInitializing = ref(true)
  const isInitialized = ref(false)
  const initializationError = ref<string | null>(null)
  const isRefreshing = ref(false)
  let initializationInFlight = false
  const { track } = useTrack()

  async function initConversation(): Promise<void> {
    if (initializationInFlight) return
    initializationInFlight = true
    isInitializing.value = true
    initializationError.value = null
    try {
      const created = await createStandaloneAgentConversation()
      const id = created.data.id
      conversationId.value = id

      const detail = await fetchAgentConversation(id)
      const raw = (detail.relationships?.messages?.data ?? []) as AgentMessageResponse[]
      messages.value = hydrateAgentMessages(raw)
      lastActivityAt.value = detail.data.lastActivityAt
      isInitialized.value = true
      track('agent_chat_opened', { standalone: true })
    } catch {
      conversationId.value = null
      messages.value = []
      lastActivityAt.value = null
      isInitialized.value = false
      initializationError.value = "Couldn't start the conversation. Try again."
    } finally {
      initializationInFlight = false
      isInitializing.value = false
    }
  }

  async function refreshConversation(): Promise<void> {
    const id = conversationId.value
    if (id === null || isRefreshing.value) return
    isRefreshing.value = true
    try {
      const detail = await fetchAgentConversation(id)
      const raw = (detail.relationships?.messages?.data ?? []) as AgentMessageResponse[]
      messages.value = hydrateAgentMessages(raw)
      lastActivityAt.value = detail.data.lastActivityAt
    } finally {
      isRefreshing.value = false
    }
  }

  async function send(content: string): Promise<void> {
    const trimmed = content.trim()
    if (
      trimmed.length === 0 ||
      isStreaming.value ||
      !isInitialized.value ||
      conversationId.value === null
    ) {
      return
    }

    const id = conversationId.value
    const { streamTurn } = useAgentTurnStream()

    track('agent_message_sent', { inSession: false })
    messages.value.push({ role: 'user', content: trimmed, toolResults: [], error: null })

    const assistant = reactive<AgentPanelMessage>({
      role: 'assistant',
      content: '',
      toolResults: [],
      error: null,
    })
    messages.value.push(assistant)

    isStreaming.value = true

    try {
      await streamTurn(id, trimmed, (event) => handleEvent(assistant, event))
      if (assistant.error === null) {
        lastActivityAt.value = new Date().toISOString()
      }
    } finally {
      isStreaming.value = false
    }
  }

  async function newChat(): Promise<void> {
    conversationId.value = null
    messages.value = []
    lastActivityAt.value = null
    isInitialized.value = false
    initializationError.value = null
    track('agent_new_chat')
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
    isInitializing,
    isInitialized,
    initializationError,
    isRefreshing,
    retryInitialization: initConversation,
    refreshConversation,
    send,
    newChat,
  }
}
