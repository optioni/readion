<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; activeCount?: number }>()
</script>

<template>
  <div data-testid="page-header" class="mb-7 flex items-end justify-between gap-4">
    <div>
      <p class="mb-1 font-medium text-[11px] text-slate-400 uppercase tracking-wider">
        {{ eyebrow }}
      </p>
      <h1 class="font-semibold text-[22px] text-slate-100 leading-tight">{{ title }}</h1>
    </div>
    <div
      v-if="activeCount !== undefined"
      data-testid="page-header-active"
      class="flex items-center gap-1.5 text-slate-400 text-xs"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-readion-status-good" />
      {{ activeCount }} active
    </div>
  </div>
</template>
