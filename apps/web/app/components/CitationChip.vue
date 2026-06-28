<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <span
    data-testid="citation-chip"
    class="inline-flex items-center gap-1 rounded-full border border-readion-accent-label/20 bg-readion-accent-label/[0.08] px-2 py-0.5"
  >
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1h4a1 1 0 011 1v9a1 1 0 01-1 1H2a1 1 0 01-1-1V5l4-4z"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
        class="text-readion-accent-label"
      />
    </svg>
    <span class="text-[10px] text-readion-accent-label">{{ label }}</span>
  </span>
</template>
