<script setup lang="ts">
import AccuracyBars, { type AccuracyPoint } from '~/components/AccuracyBars.vue'
import ReadinessTrend, { type ReadinessTrendPoint } from '~/components/ReadinessTrend.vue'

defineProps<{
  points: ReadinessTrendPoint[]
  hasData: boolean
  showProjection?: boolean
  series: AccuracyPoint[]
}>()
</script>

<template>
  <div
    data-testid="readiness-accuracy-card"
    class="w-full max-w-full min-w-0 rounded-md bg-black/25 p-3"
  >
    <ReadinessTrend :points="points" :has-data="hasData" :show-projection="showProjection" />

    <div data-testid="readiness-accuracy-divider" class="my-3 border-readion-background-surface border-t" />

    <div class="mb-2 flex items-baseline justify-between">
      <span class="text-[11px] uppercase tracking-wider opacity-70">Quiz accuracy</span>
      <span data-testid="quiz-accuracy-count" class="text-[11px] opacity-50">
        Last {{ series.length }} session{{ series.length === 1 ? '' : 's' }}
      </span>
    </div>
    <AccuracyBars :series="series" />
  </div>
</template>
