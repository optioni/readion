<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  certCode: string
  certName?: string
  mode: 'preparing' | 'active' | 'review'
  currentIndex?: number
  totalQuestions: number
  timer?: string
  paused?: boolean
  urgent?: boolean
}>()

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

// The flag is a within-sitting visual aid only — there is no flag field or endpoint in the
// mock-exam contract, so it is session-local and intentionally lost on reload.
const flagged = ref(false)
</script>

<template>
  <div
    data-testid="exam-header"
    class="flex h-13 flex-shrink-0 items-center gap-5 border-readion-border-strong border-b bg-readion-background-elevated px-7"
  >
    <div class="flex flex-shrink-0 items-center gap-2">
      <span
        data-testid="exam-cert-chip"
        class="rounded-sm bg-readion-background-elevated px-1.5 py-0.5 font-mono text-[11px] text-readion-text-muted uppercase tracking-wider"
      >
        {{ certCode }}
      </span>
      <span v-if="certName" class="truncate text-readion-text-secondary text-xs">{{ certName }}</span>
    </div>

    <div class="h-4 w-px bg-readion-border-strong" />

    <span class="text-readion-text-secondary text-xs">{{ modeLabel }}</span>

    <div class="flex-1" />

    <span
      v-if="questionNumber !== null"
      data-testid="exam-question-counter"
      class="font-mono text-[13px] text-readion-text-secondary"
    >
      Question
      <span class="font-medium text-readion-text-primary">{{ questionNumber }}</span>
      of {{ totalQuestions }}
    </span>

    <span
      v-if="paused"
      data-testid="exam-timer-paused"
      class="flex items-center gap-1.5 rounded-md border border-readion-border-strong bg-readion-background-surface px-3 py-1.5 font-mono text-[13px] text-readion-text-muted tracking-wider"
    >
      {{ PAUSED_PLACEHOLDER }}
    </span>
    <span
      v-else
      data-testid="exam-timer"
      :data-urgent="urgent ? 'true' : 'false'"
      class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[13px] tracking-wider"
      :class="timerClass"
    >
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
      @click="flagged = !flagged"
    >
      Flag
    </button>
  </div>
</template>
