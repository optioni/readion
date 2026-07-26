<script setup lang="ts">
const props = defineProps<{
  label: string
  for?: string
  hint?: string
}>()
</script>

<template>
  <div class="mb-4 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:gap-6">
    <div class="w-full min-w-0 pt-0 sm:w-40 sm:shrink-0 sm:pt-2">
      <label :for="props.for" class="text-[13px] text-readion-text-secondary">{{ label }}</label>
      <p
        v-if="hint"
        data-testid="field-row-hint"
        class="mt-0.5 text-[11px] text-readion-text-muted leading-normal"
      >
        {{ hint }}
      </p>
    </div>
    <div data-testid="settings-field-control" class="w-full min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>
