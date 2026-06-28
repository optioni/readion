<script setup lang="ts">
import CardPanel from '~/components/CardPanel.vue'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const props = defineProps<{ weakAreas: WeakAreaResponseDto[] }>()

const scoreClass = (score: number) => statusTextColorClass(statusColorForScore(score))
</script>

<template>
  <CardPanel data-testid="weak-areas-panel" label="Weak Areas">
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
  </CardPanel>
</template>
