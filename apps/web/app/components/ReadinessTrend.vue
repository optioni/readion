<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  points: number[]
  hasData: boolean
}>()

const WIDTH = 300
const HEIGHT = 80
const PAD = 8

const svgPoints = computed(() => {
  if (props.points.length === 0) {
    return ''
  }

  const min = Math.min(...props.points) - 5
  const max = Math.max(...props.points) + 5
  const range = max - min || 1

  return props.points
    .map((val, i) => {
      const x = PAD + (i / Math.max(props.points.length - 1, 1)) * (WIDTH - PAD * 2)
      const y = PAD + (1 - (val - min) / range) * (HEIGHT - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const currentValue = computed(() => props.points.at(-1) ?? null)
</script>

<template>
  <div data-testid="readiness-trend" class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Readiness Trend</div>

    <div v-if="!hasData" data-testid="progress-not-calibrated" class="py-4 text-center">
      <p class="text-slate-400 text-sm">Not yet calibrated</p>
      <p class="mt-1 text-slate-500 text-xs">
        Complete a few sessions to see your readiness trend.
      </p>
    </div>

    <template v-else>
      <div class="mb-2 flex items-end justify-between">
        <span class="font-semibold text-2xl text-slate-100">{{ currentValue }}%</span>
      </div>
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        class="w-full"
        aria-hidden="true"
      >
        <polyline
          :points="svgPoints"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-readion-primary"
        />
      </svg>
    </template>
  </div>
</template>
