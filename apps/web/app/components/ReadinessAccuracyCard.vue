<script setup lang="ts">
import AccuracyBars, { type AccuracyPoint } from '~/components/AccuracyBars.vue'
import ReadinessTrend from '~/components/ReadinessTrend.vue'

defineProps<{
  points: number[]
  hasData: boolean
  series: AccuracyPoint[]
}>()
</script>

<template>
  <div data-testid="readiness-accuracy-card" class="rounded-md bg-black/25 p-3">
    <ReadinessTrend :points="points" :has-data="hasData" />

    <div data-testid="readiness-accuracy-divider" class="my-3 border-readion-background-surface border-t" />

    <AccuracyBars :series="series" />
  </div>
</template>
