<script setup lang="ts" generic="T extends string | number">
defineProps<{
  label: string
  testidPrefix: string
  options: readonly T[]
  modelValue: T | undefined
  format?: (value: T) => string
}>()

defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-[11px] text-readion-text-muted uppercase tracking-wide">{{ label }}</span>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="option in options"
        :key="String(option)"
        type="button"
        :data-testid="`${testidPrefix}-${option}`"
        :aria-pressed="modelValue === option"
        class="rounded-full border px-2.5 py-1 text-xs"
        :class="
          modelValue === option
            ? 'border-readion-primary bg-readion-primary text-white'
            : 'border-readion-border-strong text-slate-300'
        "
        @click="$emit('update:modelValue', option)"
      >
        {{ format ? format(option) : option }}
      </button>
    </div>
  </div>
</template>
