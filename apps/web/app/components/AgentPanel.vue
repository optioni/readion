<script setup lang="ts">
import type { AgentMessageResponse } from '@readion/shared'
import { onMounted, reactive, ref } from 'vue'
import AgentBubble from '~/components/AgentBubble.vue'
import { type AgentPanelMessage, hydrateAgentMessages } from '~/composables/agentMessages'
import {
  createSessionAgentConversation,
  fetchAgentConversation,
} from '~/composables/sessionViewApi'
import {
  type AgentStreamEvent,
  extractTextDelta,
  useAgentTurnStream,
} from '~/composables/useAgentTurnStream'

const props = defineProps<{ sessionId: string }>()

const { streamTurn } = useAgentTurnStream()

const messages = ref<AgentPanelMessage[]>([])
const input = ref('')
const conversationId = ref<string | null>(null)
const isStreaming = ref(false)
const jobStatus = reactive<Record<string, string>>({})

const QUICK_SUGGESTIONS = ['Explain this', 'My progress here', 'Exam tips']

async function ensureConversation(): Promise<string> {
  if (conversationId.value !== null) {
    return conversationId.value
  }
  const created = await createSessionAgentConversation(props.sessionId)
  const id = created.data.id
  conversationId.value = id

  const detail = await fetchAgentConversation(id)
  const raw = (detail.relationships?.messages?.data ?? []) as AgentMessageResponse[]
  messages.value = hydrateAgentMessages(raw)
  return id
}

function handleEvent(assistant: AgentPanelMessage, event: AgentStreamEvent): void {
  if (event.type === 'text-delta') {
    const delta = extractTextDelta(event)
    if (delta !== null) {
      assistant.content += delta
    }
    return
  }
  if (event.type === 'tool-result' && typeof event.toolName === 'string') {
    assistant.toolResults.push({
      id: `${assistant.toolResults.length}-${event.toolName}`,
      toolName: event.toolName,
      output: event.output,
    })
    return
  }
  if (event.type === 'job-event' && typeof event.jobId === 'string') {
    jobStatus[event.jobId] = String(event.status)
    return
  }
  if (event.type === 'error') {
    assistant.error = String(event.error)
  }
}

async function send(): Promise<void> {
  const content = input.value.trim()
  if (content.length === 0 || isStreaming.value) {
    return
  }

  const id = await ensureConversation()
  messages.value.push({ role: 'user', content, toolResults: [], error: null })
  input.value = ''

  const assistant = reactive<AgentPanelMessage>({
    role: 'assistant',
    content: '',
    toolResults: [],
    error: null,
  })
  messages.value.push(assistant)

  isStreaming.value = true
  try {
    await streamTurn(id, content, (event) => handleEvent(assistant, event))
  } finally {
    isStreaming.value = false
  }
}

function suggest(suggestion: string): void {
  input.value = suggestion
  void send()
}

onMounted(() => {
  void ensureConversation()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3.5 py-3.5">
      <AgentBubble
        v-for="(message, index) in messages"
        :key="index"
        :message="message"
        :job-status="jobStatus"
      />
    </div>

    <div class="flex-shrink-0 border-readion-border-strong border-t px-3.5 py-3">
      <div
        class="flex items-center gap-2 rounded-lg border border-readion-border-strong bg-readion-background-surface px-3 py-1.5"
      >
        <input
          v-model="input"
          data-testid="agent-input"
          type="text"
          placeholder="Ask anything about this topic..."
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

      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="suggestion in QUICK_SUGGESTIONS"
          :key="suggestion"
          type="button"
          class="rounded-full border border-readion-border-strong bg-readion-background-surface px-2.5 py-0.5 text-[11px] text-readion-text-muted"
          @click="suggest(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>
  </div>
</template>
