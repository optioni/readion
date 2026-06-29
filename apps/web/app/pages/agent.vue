<script setup lang="ts">
import { ref } from 'vue'
import AgentBubble from '~/components/AgentBubble.vue'
import { AGENT_COPY, AGENT_SUGGESTIONS } from '~/composables/agentChatCopy'
import { useStandaloneAgentChat } from '~/composables/useStandaloneAgentChat'

const { messages, isStreaming, send, newChat } = useStandaloneAgentChat()
const input = ref('')

async function handleSend(): Promise<void> {
  const content = input.value
  await send(content)
  input.value = ''
}

async function handleSuggestion(text: string): Promise<void> {
  await send(text)
}

async function handleNewChat(): Promise<void> {
  await newChat()
  input.value = ''
}
</script>

<template>
  <div
    data-testid="agent-chat-page"
    class="flex min-h-0 flex-1 flex-col"
  >
    <div class="flex items-center justify-between border-b border-readion-border-strong px-5 py-3">
      <div>
        <h1 class="font-medium text-readion-text-primary text-sm">Ask AI</h1>
        <p class="text-[10px] text-readion-text-muted">{{ AGENT_COPY.headerSubtitle }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span
          data-testid="agent-ttl-chip"
          class="rounded-full border border-readion-border-strong px-2 py-0.5 text-[10px] text-readion-text-muted"
        />
        <button
          type="button"
          data-testid="agent-new-chat-button"
          class="rounded-md border border-readion-border-strong bg-readion-background-surface px-2.5 py-1 text-[11px] text-readion-text-muted transition-colors hover:text-readion-text-secondary"
          @click="handleNewChat"
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
        <p class="font-medium text-readion-text-primary text-sm">{{ AGENT_COPY.emptyHeading }}</p>
        <p class="max-w-xs text-[12px] text-readion-text-muted">{{ AGENT_COPY.emptyIntro }}</p>
        <div class="flex flex-col items-center gap-2">
          <p class="text-[10px] uppercase tracking-wider text-readion-text-muted">
            {{ AGENT_COPY.suggestionsLabel }}
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="suggestion in AGENT_SUGGESTIONS"
              :key="suggestion"
              type="button"
              data-testid="agent-suggestion"
              class="rounded-full border border-readion-border-strong bg-readion-background-surface px-3 py-1 text-[11px] text-readion-text-muted transition-colors hover:text-readion-text-secondary"
              @click="handleSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>
      </div>

      <template v-else>
        <AgentBubble
          v-for="(message, index) in messages"
          :key="index"
          :message="message"
        />
        <div
          v-if="isStreaming"
          data-testid="agent-streaming-cursor"
          class="mb-3.5 h-3.5 w-0.5 animate-[blink_1s_step-end_infinite] bg-readion-text-muted"
          aria-hidden="true"
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
          @keydown.enter="handleSend"
        />
        <button
          type="button"
          data-testid="agent-send-button"
          :disabled="isStreaming"
          aria-label="Send message"
          class="flex h-6.5 w-6.5 flex-shrink-0 items-center justify-center rounded-md bg-readion-primary text-white disabled:opacity-60"
          @click="handleSend"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      <p class="mt-1.5 text-center text-[10px] text-readion-text-muted">
        {{ AGENT_COPY.inputFooter }}
      </p>
    </div>
  </div>
</template>
