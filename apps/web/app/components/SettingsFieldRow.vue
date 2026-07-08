<script setup lang="ts">
const props = defineProps<{
  label: string
  for?: string
  hint?: string
}>()
</script>

<template>
  <div class="mb-4 flex items-start gap-6">
    <div class="w-40 shrink-0 pt-2">
      <label :for="props.for" class="text-[13px] text-readion-text-secondary">{{ label }}</label>
      <p
        v-if="hint"
        data-testid="field-row-hint"
        class="mt-0.5 text-[11px] text-readion-text-muted leading-normal"
      >
        {{ hint }}
      </p>
    </div>
    <div class="flex-1">
      <slot />
    </div>
  </div>
</template>
