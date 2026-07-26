<script setup lang="ts" generic="T extends string | number">
import ReadionButton from '~/components/ReadionButton.vue'

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
      <ReadionButton
        v-for="option in options"
        :key="String(option)"
        :data-testid="`${testidPrefix}-${option}`"
        variant="toggle"
        :selected="modelValue === option"
        class="min-h-0 rounded-full px-2.5 py-1 text-xs"
        @click="$emit('update:modelValue', option)"
      >
        {{ format ? format(option) : option }}
      </ReadionButton>
    </div>
  </div>
</template>
