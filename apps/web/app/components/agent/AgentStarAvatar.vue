<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <div
    class="flex flex-shrink-0 items-center justify-center rounded-full"
    :class="
      size === 'lg'
        ? 'h-12 w-12 border border-readion-accent-label/20 bg-readion-accent-label/[0.12]'
        : 'h-7 w-7 bg-readion-accent-label/[0.15]'
    "
  >
    <svg
      :width="size === 'lg' ? 22 : 13"
      :height="size === 'lg' ? 22 : 13"
      viewBox="0 0 12 12"
      fill="none"
      class="text-readion-accent-label"
      aria-hidden="true"
    >
      <path
        d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"
        fill="currentColor"
      />
    </svg>
  </div>
</template>
