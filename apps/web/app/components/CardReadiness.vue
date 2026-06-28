<script setup lang="ts">
import type { ReadinessDisplay } from '~/composables/readinessFormat'

defineProps<{ display: ReadinessDisplay }>()
</script>

<template>
  <div data-testid="card-readiness">
    <div v-if="display.calibrated" class="font-bold text-[28px] leading-none">
      {{ display.percent }} ready
    </div>
    <div v-else class="font-semibold text-base capitalize opacity-80">
      {{ display.label }}
    </div>
    <div
      v-if="display.delta"
      data-testid="readiness-delta"
      class="mt-1 text-[11px] opacity-80"
    >
      {{ display.delta }} since last session
    </div>
  </div>
</template>
