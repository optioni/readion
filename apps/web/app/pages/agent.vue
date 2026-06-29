<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AgentBubble from '~/components/AgentBubble.vue'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import type { AgentPanelMessage } from '~/composables/agentMessages'

const conversationId = ref<string | null>(null)
const messages = ref<AgentPanelMessage[]>([])
const isStreaming = ref(false)
const input = ref('')
const lastActivityAt = ref<string | null>(null)

const QUICK_SUGGESTIONS = ['Explain this topic', 'What should I study next?', 'Quiz me on this']

onMounted(async () => {
  const detail = await createStandaloneAgentConversation()
  conversationId.value = detail.data.id
  lastActivityAt.value = detail.data.lastActivityAt
})

async function send(): Promise<void> {
  const content = input.value.trim()
  if (content.length === 0 || isStreaming.value || conversationId.value === null) {
    return
  }
}

async function newChat(): Promise<void> {
  conversationId.value = null
  messages.value = []
  input.value = ''
  lastActivityAt.value = null
  const detail = await createStandaloneAgentConversation()
  conversationId.value = detail.data.id
  lastActivityAt.value = detail.data.lastActivityAt
}
</script>

<template>
  <div
    data-testid="agent-chat-page"
    class="flex min-h-0 flex-1 flex-col"
  >
    <div class="flex items-center justify-between border-b border-readion-border-strong px-5 py-3">
      <h1 class="font-medium text-readion-text-primary text-sm">Ask AI</h1>
      <div class="flex items-center gap-2">
        <span
          data-testid="agent-ttl-chip"
          class="rounded-full border border-readion-border-strong px-2 py-0.5 text-[10px] text-readion-text-muted"
        />
        <button
          type="button"
          data-testid="agent-new-chat-button"
          class="rounded-md border border-readion-border-strong bg-readion-background-surface px-2.5 py-1 text-[11px] text-readion-text-muted transition-colors hover:text-readion-text-secondary"
          @click="newChat"
        >
          New chat
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div
        v-if="messages.length === 0"
        data-testid="agent-empty-state"
        class="flex flex-col items-center gap-4 py-10 text-center"
      >
        <p class="font-medium text-readion-text-primary text-sm">What would you like to learn today?</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="suggestion in QUICK_SUGGESTIONS"
            :key="suggestion"
            type="button"
            data-testid="agent-suggestion"
            class="rounded-full border border-readion-border-strong bg-readion-background-surface px-3 py-1 text-[11px] text-readion-text-muted transition-colors hover:text-readion-text-secondary"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <template v-else>
        <AgentBubble
          v-for="(message, index) in messages"
          :key="index"
          :message="message"
        />
      </template>
    </div>

    <div class="flex-shrink-0 border-readion-border-strong border-t px-5 py-3">
      <div
        class="flex items-center gap-2 rounded-lg border border-readion-border-strong bg-readion-background-surface px-3 py-1.5"
      >
        <input
          v-model="input"
          data-testid="agent-input"
          type="text"
          placeholder="Ask anything..."
          class="flex-1 bg-transparent text-[13px] text-readion-text-primary outline-none"
          @keydown.enter="send"
        />
        <button
          type="button"
          data-testid="agent-send-button"
          :disabled="isStreaming"
          aria-label="Send message"
          class="flex h-6.5 w-6.5 flex-shrink-0 items-center justify-center rounded-md bg-readion-primary text-white disabled:opacity-60"
          @click="send"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
