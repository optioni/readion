<script setup lang="ts">
import CardPanel from '~/components/CardPanel.vue'
import DomainBadge from '~/components/DomainBadge.vue'
import type { WeakAreaResponseDto } from '~~/src/api/model'

const props = defineProps<{ weakAreas: WeakAreaResponseDto[]; hero?: boolean }>()
</script>

<template>
  <CardPanel data-testid="weak-areas-panel" label="Weak Areas">
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
  </CardPanel>
</template>
