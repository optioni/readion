<script setup lang="ts">
import { computed } from 'vue'
import { formatPaceString } from '~/composables/paceFormatter'

const props = defineProps<{
  weeksToReady: number | null
  paceRate: number | null
}>()

const paceText = computed(() => {
  if (props.weeksToReady === null || props.paceRate === null) {
    return null
  }
  return formatPaceString({ paceRate: props.paceRate, weeksToReady: props.weeksToReady })
})
</script>

<template>
  <div
    v-if="paceText !== null"
    data-testid="trajectory-callout"
    class="flex items-start gap-3 rounded-lg border border-readion-primary/20 bg-readion-primary/10 px-4 py-3"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mt-0.5 size-4 shrink-0 text-readion-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
    <span class="text-readion-primary text-sm">{{ paceText }}</span>
  </div>

  <div
    v-else
    data-testid="trajectory-insufficient"
    class="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mt-0.5 size-4 shrink-0 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <span class="text-slate-400 text-sm">Complete at least 5 sessions to see your pace estimate.</span>
  </div>
</template>
