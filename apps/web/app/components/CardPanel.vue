<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">{{ label }}</div>
    <slot />
  </div>
</template>
