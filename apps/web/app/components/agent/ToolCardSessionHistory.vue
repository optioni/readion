<script setup lang="ts">
import { computed } from 'vue'
import ToolCard from '~/components/agent/ToolCard.vue'

type DomainAccuracy = { domain: string; accuracy: number }
type SessionEntry = {
  sessionId: string
  kind: string
  status: string
  endedAt: string | null
  domains: DomainAccuracy[]
}
type SessionHistoryOutput = { sessions?: SessionEntry[] }

const props = defineProps<{ output: unknown; jobStatus?: string | null }>()

const sessions = computed(() => ((props.output ?? {}) as SessionHistoryOutput).sessions ?? [])

function pct(accuracy: number): number {
  return Math.round(accuracy * 100)
}
</script>

<template>
  <ToolCard label="Recent sessions">
    <div
      v-for="session in sessions"
      :key="session.sessionId"
      class="mb-2.5 border-readion-border-default border-b pb-2.5 last:mb-0 last:border-b-0 last:pb-0"
    >
      <div
        class="mb-1 flex items-center justify-between text-[10px] text-readion-text-muted uppercase tracking-wider"
      >
        <span>{{ session.kind }}</span>
        <span>{{ session.status }}</span>
      </div>
      <div
        v-for="domain in session.domains"
        :key="domain.domain"
        class="flex items-center justify-between text-readion-text-secondary text-xs"
      >
        <span>{{ domain.domain }}</span>
        <span class="font-semibold text-readion-text-primary">{{ pct(domain.accuracy) }}%</span>
      </div>
    </div>
  </ToolCard>
</template>
