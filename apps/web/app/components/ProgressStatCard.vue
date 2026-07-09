<script setup lang="ts">
defineProps<{
  label: string
  value: string
  unit?: string
  unitClass?: string
  valueClass?: string
  subCaption?: string
}>()
</script>

<template>
  <div
    data-testid="progress-stat-card"
    class="flex-1 rounded-xl border border-readion-background-surface bg-readion-background-surface/40 p-4"
  >
    <div class="mb-1.5 text-[10px] uppercase tracking-wider opacity-70">{{ label }}</div>
    <div class="flex items-baseline gap-1">
      <span class="font-semibold text-2xl" :class="valueClass ?? 'text-slate-100'">{{ value }}</span>
      <span v-if="unit" class="text-sm" :class="unitClass ?? 'text-slate-400'">{{ unit }}</span>
    </div>
    <div v-if="subCaption" data-testid="progress-stat-sub-caption" class="mt-1 text-[11px] opacity-60">
      {{ subCaption }}
    </div>
  </div>
</template>
