<script setup lang="ts">
import { computed } from 'vue'
import { statusBorderColorClass, statusTextColorClass } from '~/composables/statusColor'

const props = withDefaults(defineProps<{ value: number; suffix?: string }>(), {
  suffix: '%',
})

const positive = computed(() => props.value >= 0)
const colorKey = computed(() => (positive.value ? 'good' : 'poor'))
const textClass = computed(() => statusTextColorClass(colorKey.value))
const borderClass = computed(() => statusBorderColorClass(colorKey.value))
</script>

<template>
  <span
    data-testid="delta-badge"
    class="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-medium text-[11px]"
    :class="[textClass, `${borderClass}/20`]"
  >
    {{ positive ? '↑' : '↓' }}{{ Math.abs(value) }}{{ suffix }}
  </span>
</template>
