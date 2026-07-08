<script setup lang="ts">
defineProps<{
  label: string
  value: string
  unit?: string
  unitClass?: string
  valueClass?: string
}>()
</script>

<template>
  <div data-testid="progress-stat-card">
    <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">{{ label }}</div>
    <div class="flex items-baseline gap-1">
      <span class="font-semibold text-2xl" :class="valueClass ?? 'text-slate-100'">{{ value }}</span>
      <span v-if="unit" class="text-sm" :class="unitClass ?? 'text-slate-400'">{{ unit }}</span>
    </div>
  </div>
</template>
