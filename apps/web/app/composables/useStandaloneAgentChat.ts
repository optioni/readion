import type { AgentMessageResponse } from '@readion/shared'
import { onMounted, ref } from 'vue'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import { type AgentPanelMessage, hydrateAgentMessages } from '~/composables/agentMessages'
import { fetchAgentConversation } from '~/composables/sessionViewApi'

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
    if (content.trim().length === 0 || isStreaming.value || conversationId.value === null) {
      return
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
