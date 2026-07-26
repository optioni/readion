<script setup lang="ts">
import { computed, ref } from 'vue'
import AgentBubble from '~/components/AgentBubble.vue'
import AgentStarAvatar from '~/components/agent/AgentStarAvatar.vue'
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { AGENT_COPY, AGENT_SUGGESTIONS } from '~/composables/agentChatCopy'
import { useAgentChatTtl } from '~/composables/agentChatTtl'
import { useStandaloneAgentChat } from '~/composables/useStandaloneAgentChat'

definePageMeta({ layout: 'minimal' })

const {
  messages,
  isStreaming,
  lastActivityAt,
  isInitializing,
  isInitialized,
  initializationError,
  isRefreshing,
  retryInitialization,
  send,
  newChat,
} = useStandaloneAgentChat()
const input = ref('')
const hasInput = computed(() => input.value.trim().length > 0)
const newChatPending = ref(false)
const pendingSuggestion = ref<string | null>(null)

const { warning: ttlWarning, warningMinutes: ttlBannerMinutes } = useAgentChatTtl(lastActivityAt)

async function handleSend(): Promise<void> {
  if (isStreaming.value || !isInitialized.value || !hasInput.value) return
  const content = input.value
  await send(content)
  input.value = ''
}

async function handleSuggestion(text: string): Promise<void> {
  if (isStreaming.value || pendingSuggestion.value) return
  pendingSuggestion.value = text
  try {
    await send(text)
  } finally {
    pendingSuggestion.value = null
  }
}

async function handleNewChat(): Promise<void> {
  if (newChatPending.value || isInitializing.value) return
  newChatPending.value = true
  try {
    await newChat()
    input.value = ''
  } finally {
    newChatPending.value = false
  }
}
</script>

<template>
  <div
    data-testid="agent-chat-page"
    class="flex min-h-0 flex-1 flex-col"
    :aria-busy="isInitializing || isRefreshing ? 'true' : undefined"
  >
    <div
      data-testid="agent-header"
      class="flex flex-shrink-0 items-center justify-between border-b border-readion-border-strong px-5 py-3"
    >
      <div class="flex items-center gap-2">
        <AgentStarAvatar
          data-testid="agent-header-avatar"
          size="sm"
        />
        <div>
          <h1 class="font-medium text-readion-text-primary text-sm">{{ AGENT_COPY.headerTitle }}</h1>
          <p class="text-[10px] text-readion-text-muted">{{ AGENT_COPY.headerSubtitle }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <ReadionButton
          data-testid="agent-new-chat-button"
          variant="secondary"
          :disabled="isInitializing && !newChatPending"
          :busy="newChatPending"
          busy-label="Starting…"
          class="!min-h-0 px-2.5 py-1 text-[11px]"
          @click="handleNewChat"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
          New chat
        </ReadionButton>
      </div>
    </div>

    <div
      v-if="ttlWarning"
      data-testid="agent-expiry-banner"
      class="border-b border-readion-warning/30 bg-readion-warning/10 px-5 py-2 text-[11px] text-readion-text-secondary"
      role="status"
      aria-live="polite"
    >
      This conversation expires after inactivity. {{ ttlBannerMinutes }} minutes remaining. Send a
      message to reset the timer.
    </div>

    <div data-testid="agent-message-list" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <ReadionAsyncRegion
        data-testid="agent-conversation-region"
        aria-label="Agent conversation"
        class="mx-auto w-full max-w-[760px]"
        :loading="isInitializing && !isInitialized"
        :error="initializationError ?? undefined"
        :empty="isInitialized && messages.length === 0"
        :refreshing="isRefreshing"
        loading-label="Starting conversation…"
        refresh-label="Refreshing conversation…"
        @retry="retryInitialization"
      >
        <template #empty>
        <div
          data-testid="agent-empty-state"
          class="flex flex-col items-center gap-4 py-10 text-center"
        >
          <AgentStarAvatar
            data-testid="agent-empty-avatar"
            size="lg"
          />
          <p class="font-medium text-readion-text-primary text-sm">{{ AGENT_COPY.emptyHeading }}</p>
          <p class="max-w-xs text-[12px] text-readion-text-muted">{{ AGENT_COPY.emptyIntro }}</p>
          <div class="flex w-full max-w-[440px] flex-col items-center gap-1.5">
            <p class="text-[10px] uppercase tracking-wider text-readion-text-muted">
              {{ AGENT_COPY.suggestionsLabel }}
            </p>
            <div
              data-testid="agent-suggestion-list"
              class="flex w-full flex-col gap-1.5"
            >
              <ReadionButton
                v-for="suggestion in AGENT_SUGGESTIONS"
                :key="suggestion"
                data-testid="agent-suggestion"
                variant="secondary"
                :busy="pendingSuggestion === suggestion"
                busy-label="Sending…"
                :disabled="isStreaming || (pendingSuggestion !== null && pendingSuggestion !== suggestion)"
                class="w-full justify-between px-3.5 py-2 text-left text-[13px]"
                @click="handleSuggestion(suggestion)"
              >
                <span class="flex w-full items-center justify-between gap-2">
                  <span>{{ suggestion }}</span>
                  <svg
                    data-testid="agent-suggestion-arrow"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="flex-shrink-0 text-readion-text-subtle"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </ReadionButton>
            </div>
          </div>
        </div>
        </template>

        <AgentBubble
          v-for="(message, index) in messages"
          :key="index"
          :message="message"
          :streaming="isStreaming && index === messages.length - 1"
        />
      </ReadionAsyncRegion>
    </div>

    <div
      data-testid="agent-composer"
      class="flex-shrink-0 border-readion-border-strong border-t px-5 py-3"
    >
      <div class="mx-auto flex w-full max-w-[760px] flex-col">
        <div
          class="flex items-center gap-2 rounded-lg border border-readion-border-strong bg-readion-background-surface px-3 py-1.5"
        >
          <textarea
            v-model="input"
            data-testid="agent-input"
            rows="1"
            placeholder="Ask anything…"
            class="flex-1 resize-none bg-transparent text-[13px] text-readion-text-primary outline-none"
            @keydown.enter.exact.prevent="handleSend"
          />
          <button
            type="button"
            data-testid="agent-send-button"
            :disabled="isStreaming || !isInitialized || !hasInput"
            :aria-busy="isStreaming ? 'true' : undefined"
            :aria-label="isStreaming ? 'Sending message' : 'Send message'"
            :data-state="
              isStreaming ? 'busy' : !isInitialized || !hasInput ? 'disabled' : 'rest'
            "
            class="readion-interactive-control flex h-6.5 w-6.5 flex-shrink-0 items-center justify-center rounded-md text-readion-text-on-primary transition-[color,background-color,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-readion-focus focus-visible:ring-offset-2 focus-visible:ring-offset-readion-background-surface active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              hasInput
                ? 'bg-readion-primary hover:bg-readion-primary-hover active:bg-readion-primary-active'
                : 'bg-readion-border-strong'
            "
            @click="handleSend"
          >
            <svg
              v-if="isStreaming"
              data-testid="agent-send-spinner"
              class="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
              aria-hidden="true"
            />
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span v-if="isStreaming" class="sr-only" role="status">Sending…</span>
          </button>
        </div>
        <p class="mt-1.5 text-center text-[10px] text-readion-text-muted">
          {{ AGENT_COPY.inputFooter }}
        </p>
      </div>
    </div>
  </div>
</template>
