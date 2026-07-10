<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  certCode: string
  certName?: string
  mode: 'preparing' | 'active' | 'review'
  currentIndex?: number
  totalQuestions: number
  timer?: string
  paused?: boolean
  urgent?: boolean
  flagged?: boolean
}>()

const emit = defineEmits<{ 'toggle-flag': [] }>()

const PAUSED_PLACEHOLDER = '--:--:--'

const modeLabel = computed<string>(() => {
  switch (props.mode) {
    case 'preparing':
      return 'Preparing exam…'
    case 'review':
      return 'Review mode'
    default:
      return 'Mock Exam'
  }
})

const questionNumber = computed<number | null>(() =>
  props.currentIndex === undefined ? null : props.currentIndex + 1,
)

const timerClass = computed<string>(() =>
  props.urgent
    ? 'border-readion-status-poor/30 bg-readion-status-poor/10 text-readion-status-poor'
    : 'border-readion-border-strong bg-readion-background-surface text-readion-text-muted',
)

// Only the active state trims to the code alone — preparing/review keep the full cert name.
const showCertName = computed(() => props.mode !== 'active')
</script>

<template>
  <div
    data-testid="exam-header"
    class="flex h-13 flex-shrink-0 items-center gap-5 border-readion-border-strong border-b bg-readion-background-elevated px-7"
  >
    <div class="flex flex-shrink-0 items-center gap-2">
      <span
        data-testid="exam-logo-mark"
        class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-readion-accent-label"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"
            fill="#0f172a"
          />
        </svg>
      </span>
      <span
        data-testid="exam-cert-chip"
        class="rounded-sm bg-readion-background-elevated px-1.5 py-0.5 font-mono text-[11px] text-readion-text-muted uppercase tracking-wider"
      >
        {{ certCode }}
      </span>
      <span v-if="certName && showCertName" class="truncate text-readion-text-secondary text-xs">{{ certName }}</span>
    </div>

    <div class="h-4 w-px bg-readion-border-strong" />

    <span class="text-readion-text-secondary text-xs">{{ modeLabel }}</span>

    <div class="flex-1" />

    <span
      v-if="questionNumber !== null"
      data-testid="exam-question-counter"
      class="font-mono text-[13px] text-readion-text-secondary"
    >
      Q
      <span class="font-medium text-readion-text-primary">{{ questionNumber }}</span>
      / {{ totalQuestions }}
    </span>

    <span
      v-if="paused"
      data-testid="exam-timer-paused"
      class="flex items-center gap-1.5 rounded-md border border-readion-border-strong bg-readion-background-surface px-3 py-1.5 font-mono text-[13px] text-readion-text-muted tracking-wider"
    >
      <svg
        data-testid="exam-timer-icon"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      {{ PAUSED_PLACEHOLDER }}
    </span>
    <span
      v-else
      data-testid="exam-timer"
      :data-urgent="urgent ? 'true' : 'false'"
      class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[13px] tracking-wider"
      :class="timerClass"
    >
      <svg
        data-testid="exam-timer-icon"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      {{ timer }}
    </span>

    <button
      v-if="mode === 'active'"
      type="button"
      data-testid="exam-flag-toggle"
      :data-flagged="flagged ? 'true' : 'false'"
      class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
      :class="
        flagged
          ? 'border-readion-status-warning/40 bg-readion-status-warning/10 text-readion-status-warning'
          : 'border-readion-border-strong text-readion-text-muted'
      "
      @click="emit('toggle-flag')"
    >
      <svg
        data-testid="exam-flag-icon"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        :fill="flagged ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
      Flag
    </button>
  </div>
</template>
