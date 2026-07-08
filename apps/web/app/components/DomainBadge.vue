<script setup lang="ts">
import { computed } from 'vue'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'

const props = defineProps<{ label: string; score: number; hero?: boolean }>()

const status = computed(() => statusColorForScore(props.score))
const dotClass = computed(() => (props.hero ? 'bg-white' : `bg-readion-status-${status.value}`))
const labelClass = computed(() =>
  props.hero ? 'text-white' : statusTextColorClass(status.value),
)
const chipClass = computed(() =>
  props.hero
    ? 'border-white/20 bg-white/10'
    : `border-transparent bg-readion-status-${status.value}/10`,
)
</script>

<template>
  <span
    data-testid="domain-badge"
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
    :class="chipClass"
  >
    <span data-testid="domain-badge-dot" class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="dotClass" />
    <span class="font-medium" :class="labelClass">{{ label }}</span>
    <span :class="hero ? 'text-white/55' : labelClass" class="opacity-75">{{ score }}%</span>
  </span>
</template>
