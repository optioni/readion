<script setup lang="ts">
export interface AccuracyPoint {
  sessionId: string
  accuracy: number
}

defineProps<{
  series: AccuracyPoint[]
}>()
</script>

<template>
  <div data-testid="accuracy-bars" class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Accuracy per Session</div>

    <div v-if="series.length > 0" class="flex h-20 items-end gap-1">
      <div
        v-for="point in series"
        :key="point.sessionId"
        data-testid="accuracy-bar"
        class="relative flex flex-1 flex-col items-center justify-end"
        :title="`${point.accuracy}%`"
      >
        <span class="mb-1 text-[10px] text-slate-400">{{ point.accuracy }}</span>
        <div
          class="w-full rounded-t bg-readion-primary/60"
          :style="{ height: `${point.accuracy}%` }"
        />
      </div>
    </div>

    <div v-else class="py-4 text-center text-slate-500 text-xs">No accuracy data yet</div>
  </div>
</template>
