<script setup lang="ts">
import { computed } from 'vue'
import AgentToolResult from '~/components/agent/AgentToolResult.vue'
import type { AgentPanelMessage, AgentToolResultPart } from '~/composables/agentMessages'

const props = defineProps<{
  message: AgentPanelMessage
  jobStatus?: Record<string, string>
}>()

const isUser = computed(() => props.message.role === 'user')

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
    class="mb-3.5 flex flex-col"
    :class="isUser ? 'items-end' : 'items-start'"
  >
    <div v-if="!isUser" class="mb-1 flex items-center gap-1.5">
      <span class="text-[10px] text-readion-text-muted">Study assistant</span>
    </div>

    <div
      class="max-w-[90%] rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed"
      :class="
        isUser
          ? 'border-readion-primary bg-readion-primary text-white'
          : 'border-readion-border-strong bg-readion-background-surface text-readion-text-secondary'
      "
    >
      <p v-if="message.content" class="whitespace-pre-wrap">{{ message.content }}</p>

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
