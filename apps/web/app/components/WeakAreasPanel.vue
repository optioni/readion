<script setup lang="ts">
import { statusColorForScore } from '~/composables/statusColor'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const props = defineProps<{ weakAreas: WeakAreaResponseDto[] }>()

const scoreClass = (score: number) => `text-readion-status-${statusColorForScore(score)}`
</script>

<template>
  <div data-testid="weak-areas-panel" class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Weak Areas</div>
    <template v-if="props.weakAreas.length > 0">
      <div
        v-for="area in props.weakAreas"
        :key="area.id"
        data-testid="weak-area-row"
        class="mb-1 flex justify-between text-xs"
      >
        <span>{{ area.domain }}</span>
        <span data-testid="weak-area-score" :class="scoreClass(area.score)">{{ area.score }}%</span>
      </div>
    </template>
    <div v-else class="text-xs opacity-50">No data yet</div>
  </div>
</template>
