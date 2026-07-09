<script setup lang="ts">
import { computed } from 'vue'
import AgentToolResult from '~/components/agent/AgentToolResult.vue'
import {
  type AgentPanelMessage,
  type AgentToolResultPart,
  splitParagraphs,
} from '~/composables/agentMessages'

const props = withDefaults(
  defineProps<{
    message: AgentPanelMessage
    jobStatus?: Record<string, string>
    streaming?: boolean
  }>(),
  { streaming: false },
)

const isUser = computed(() => props.message.role === 'user')

const paragraphs = computed(() => {
  const split = splitParagraphs(props.message.content)
  if (split.length > 0) {
    return split
  }
  // While the assistant's turn is streaming, keep an (empty) paragraph so the inline cursor has
  // somewhere to render before the first text-delta arrives.
  return props.streaming && !isUser.value ? [''] : []
})

function statusFor(part: AgentToolResultPart): string | null {
  const jobId = (part.output as { jobId?: unknown } | null)?.jobId
  if (typeof jobId !== 'string') {
    return null
  }
  return props.jobStatus?.[jobId] ?? null
}
</script>

<template>
  <div
    data-testid="agent-message"
    class="mb-3.5 flex"
    :class="isUser ? 'flex-col items-end' : 'items-start gap-2.5'"
  >
    <div
      v-if="!isUser"
      data-testid="agent-message-avatar"
      class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.15]"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z" fill="#fff" />
      </svg>
    </div>

    <div
      data-testid="agent-message-bubble"
      class="max-w-[90%] rounded-[10px] px-3 py-2 text-[13px] leading-relaxed"
      :class="
        isUser
          ? 'border border-readion-border-strong bg-readion-background-surface text-readion-text-secondary'
          : 'bg-readion-primary text-white'
      "
    >
      <p
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        class="whitespace-pre-wrap"
        :class="index < paragraphs.length - 1 ? 'mb-2' : ''"
      >{{ paragraph }}<span
          v-if="streaming && !isUser && index === paragraphs.length - 1"
          data-testid="agent-streaming-cursor"
          class="ml-0.5 inline-block h-3 w-0.5 animate-[blink_1s_step-end_infinite] bg-white/80"
          aria-hidden="true"
        /></p>

      <AgentToolResult
        v-for="part in message.toolResults"
        :key="part.id"
        :part="part"
        :job-status="statusFor(part)"
      />

      <div
        v-if="message.error"
        data-testid="agent-error"
        class="mt-2 rounded-md border border-readion-status-poor/30 bg-readion-status-poor/10 px-2.5 py-1.5 text-readion-status-poor text-xs"
      >
        {{ message.error }}
      </div>
    </div>
  </div>
</template>
