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
  <div data-testid="accuracy-bars">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Accuracy per Session</div>

    <!-- Fixed-height plot area (56px bars + 20px label row) so the per-bar percentage maps to a definite pixel height; matches openspec/design/Progress.html. -->
    <div v-if="series.length > 0" class="flex items-end gap-1" :style="{ height: '76px' }">
      <div
        v-for="(point, index) in series"
        :key="point.sessionId"
        data-testid="accuracy-bar"
        class="relative flex flex-1 flex-col items-center justify-end gap-1"
        :title="`${point.accuracy}%`"
      >
        <span
          class="text-[10px]"
          :class="
            index === series.length - 1 ? 'font-semibold text-readion-primary' : 'text-slate-400'
          "
        >{{ point.accuracy }}</span>
        <div
          data-testid="accuracy-bar-fill"
          class="w-full rounded-t"
          :class="index === series.length - 1 ? 'bg-readion-primary' : 'bg-readion-primary/40'"
          :style="{ height: `${Math.max(2, (point.accuracy / 100) * 56)}px` }"
        />
      </div>
    </div>

    <div v-else class="py-4 text-center text-slate-500 text-xs">No accuracy data yet</div>
  </div>
</template>
