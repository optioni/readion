<script setup lang="ts">
import { computed } from 'vue'
import AgentChip from '~/components/agent/AgentChip.vue'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'

type DomainProgress = {
  domain: string
  score: number
  accuracy: number
}

type ProgressOutput = {
  readiness?: { calibrated?: boolean; score?: number | null }
  domains?: DomainProgress[]
}

const props = defineProps<{ output: unknown; jobStatus?: string | null }>()

const data = computed(() => (props.output ?? {}) as ProgressOutput)
const domains = computed(() => data.value.domains ?? [])

const readinessLabel = computed(() => {
  const readiness = data.value.readiness
  if (!readiness || readiness.calibrated === false || readiness.score == null) {
    return 'Readiness —'
  }
  return `Readiness ${Math.round(readiness.score * 100)}%`
})

function pct(score: number): number {
  return Math.round(score * 100)
}

function barColorClass(score: number): string {
  return statusTextColorClass(statusColorForScore(pct(score)))
}
</script>

<template>
  <div
    data-testid="tool-result-card"
    class="mt-1.5 rounded-lg border border-readion-border-strong bg-readion-background-surface px-3.5 py-3"
  >
    <div class="mb-2.5 flex items-center justify-between">
      <span class="text-[10px] text-readion-accent-label uppercase tracking-wider">Your progress</span>
      <AgentChip data-testid="readiness-chip" :label="readinessLabel" tone="accent" />
    </div>

    <div
      v-for="domain in domains"
      :key="domain.domain"
      data-testid="progress-domain-bar"
      class="mb-2 last:mb-0"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="text-readion-text-secondary text-xs">{{ domain.domain }}</span>
        <span class="font-semibold text-readion-text-primary text-xs">{{ pct(domain.score) }}%</span>
      </div>
      <div class="h-1.5 rounded bg-readion-border-strong">
        <div
          class="h-full rounded"
          :class="barColorClass(domain.score)"
          :style="{ width: `${pct(domain.score)}%`, backgroundColor: 'currentColor' }"
        />
      </div>
    </div>
  </div>
</template>
