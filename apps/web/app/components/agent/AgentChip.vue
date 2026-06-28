<script setup lang="ts">
type ChipTone = 'accent' | 'good' | 'muted' | 'warning'

const props = withDefaults(defineProps<{ label: string; tone?: ChipTone }>(), { tone: 'accent' })

const toneClass: Record<ChipTone, string> = {
  accent: 'border-readion-accent-label/20 bg-readion-accent-label/[0.08] text-readion-accent-label',
  good: 'border-readion-status-good/30 bg-readion-status-good/10 text-readion-status-good',
  warning:
    'border-readion-status-warning/30 bg-readion-status-warning/10 text-readion-status-warning',
  muted: 'border-readion-border-strong bg-readion-background-surface text-readion-text-muted',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
    :class="toneClass[props.tone]"
  >
    {{ props.label }}
  </span>
</template>
