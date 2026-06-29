<script setup lang="ts">
import { computed } from 'vue'
import { statusColorForScore } from '~/composables/statusColor'

// Read-only go-live coverage bar: chunkCount vs chunkThreshold for one domain.
// Shared by the per-domain coverage list (step 3/4) so the bar logic lives once.
const props = defineProps<{
  name: string
  chunkCount: number
  chunkThreshold: number
  met: boolean
}>()

const percent = computed(() => {
  if (props.chunkThreshold <= 0) return 100
  return Math.min(100, (props.chunkCount / props.chunkThreshold) * 100)
})

const barWidth = computed(() => `${percent.value}%`)
const barColorClass = computed(() => `bg-readion-status-${statusColorForScore(percent.value)}`)
</script>

<template>
  <div data-testid="coverage-domain-bar" :data-domain="name" class="flex flex-col gap-1">
    <div class="flex items-center justify-between text-xs">
      <span class="font-medium text-slate-100">{{ name }}</span>
      <span class="font-mono text-slate-400">
        {{ chunkCount }} / {{ chunkThreshold }}
        <span class="ml-2">{{ met ? 'Met' : 'Below threshold' }}</span>
      </span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-readion-background-surface">
      <div
        data-testid="coverage-bar-fill"
        class="h-full rounded-full transition-all"
        :class="barColorClass"
        :style="{ width: barWidth }"
      />
    </div>
  </div>
</template>
