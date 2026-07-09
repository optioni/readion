<script setup lang="ts">
import { computed } from 'vue'
import DeltaBadge from '~/components/DeltaBadge.vue'
import type { StatusColorKey } from '~/composables/statusColor'

const props = defineProps<{
  domain: string
  score: number | null
  status: StatusColorKey | null
  hasData: boolean
  delta?: number | null
  mastered?: boolean
}>()

const showBar = computed(() => props.hasData && props.score !== null && props.status !== null)
const fillWidth = computed(() => `${props.score}%`)
const fillColorClass = computed(() => `bg-readion-status-${props.status}`)
const ariaLabel = computed(() => `${props.domain} score ${props.score}%`)
const showDelta = computed(() => props.delta !== null && props.delta !== undefined)
</script>

<template>
  <div data-testid="domain-score-bar" class="flex flex-col gap-1">
    <div class="flex items-center justify-between gap-3 text-sm">
      <span class="text-slate-200" :class="{ 'text-slate-500 line-through': mastered }">{{
        domain
      }}</span>
      <div class="flex items-center gap-2">
        <span v-if="showBar" class="font-medium text-slate-100">{{ score }}%</span>
        <span v-else class="text-slate-500 text-xs">No data yet</span>
        <span v-if="showDelta" data-testid="domain-delta">
          <DeltaBadge :value="delta as number" />
        </span>
        <span
          v-if="mastered"
          data-testid="mastered-pill"
          class="rounded-full border border-readion-status-good/20 bg-readion-status-good/10 px-1.5 py-0.5 font-medium text-[10px] text-readion-status-good uppercase tracking-wide"
        >
          Mastered
        </span>
      </div>
    </div>
    <div
      v-if="showBar"
      :aria-label="ariaLabel"
      class="h-2 w-full overflow-hidden rounded-full bg-readion-background-surface"
    >
      <div
        data-testid="domain-score-bar-fill"
        class="h-full rounded-full transition-all"
        :class="[fillColorClass, { 'opacity-40': mastered }]"
        :style="{ width: fillWidth }"
      />
    </div>
    <div
      v-else
      class="h-2 w-full overflow-hidden rounded-full bg-readion-background-surface"
    />
  </div>
</template>
