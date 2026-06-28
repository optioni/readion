<script setup lang="ts">
type ToolCardTone = 'accent' | 'warning'

const props = withDefaults(defineProps<{ label: string; tone?: ToolCardTone }>(), {
  tone: 'accent',
})

const containerClass: Record<ToolCardTone, string> = {
  accent: 'border-readion-border-strong bg-readion-background-surface',
  warning: 'border-readion-status-warning/30 bg-readion-status-warning/[0.06]',
}

const labelClass: Record<ToolCardTone, string> = {
  accent: 'text-readion-accent-label',
  warning: 'text-readion-status-warning',
}
</script>

<template>
  <div
    data-testid="tool-result-card"
    class="mt-1.5 rounded-lg border px-3.5 py-3"
    :class="containerClass[props.tone]"
  >
    <div class="mb-2 flex items-center justify-between gap-1.5">
      <span class="text-[10px] uppercase tracking-wider" :class="labelClass[props.tone]">
        <slot name="label">{{ props.label }}</slot>
      </span>
      <slot name="header-right" />
    </div>
    <slot />
  </div>
</template>
