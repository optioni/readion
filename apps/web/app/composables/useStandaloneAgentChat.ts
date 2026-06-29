import { onMounted, ref } from 'vue'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import type { AgentPanelMessage } from '~/composables/agentMessages'

export function useStandaloneAgentChat() {
  const conversationId = ref<string | null>(null)
  const messages = ref<AgentPanelMessage[]>([])
  const isStreaming = ref(false)
  const lastActivityAt = ref<string | null>(null)

  async function initConversation(): Promise<void> {
    const detail = await createStandaloneAgentConversation()
    conversationId.value = detail.data.id
    lastActivityAt.value = detail.data.lastActivityAt
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
