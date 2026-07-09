<script setup lang="ts">
import DomainBadge from '~/components/DomainBadge.vue'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const props = defineProps<{ weakAreas: WeakAreaResponseDto[]; hero?: boolean }>()
</script>

<template>
  <div data-testid="weak-areas-panel">
    <div class="mb-2 text-[10px] uppercase tracking-wider opacity-70">Weak areas</div>
    <div v-if="props.weakAreas.length > 0" class="flex flex-wrap gap-1.5">
      <DomainBadge
        v-for="area in props.weakAreas"
        :key="area.id"
        :label="area.domain"
        :score="area.score"
        :hero="props.hero"
      />
    </div>
    <div v-else class="text-xs opacity-50">No data yet</div>
  </div>
</template>
