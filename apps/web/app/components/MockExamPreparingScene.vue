<script setup lang="ts">
import type { MockExamResponse } from '@readion/shared'
import { computed } from 'vue'
import ExamHeader from '~/components/ExamHeader.vue'
import MockExamNavPanel from '~/components/MockExamNavPanel.vue'

const props = defineProps<{
  exam: Pick<MockExamResponse, 'questions'>
  certCode: string
  certName?: string
  targetCount?: number
}>()

const readyCount = computed<number>(() => props.exam.questions.length)

// The contract does not echo the final question count until `ready`, so the page supplies the target
// (the certification's question count). Until then, fall back to what has streamed in so the bar never
// exceeds 100%.
const total = computed<number>(() => props.targetCount ?? readyCount.value)
</script>

<template>
  <div data-testid="exam-preparing-scene" class="flex min-h-0 flex-1 flex-col bg-readion-background-base">
    <ExamHeader :cert-code="certCode" :cert-name="certName" mode="preparing" :total-questions="total" paused />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div class="flex flex-1 flex-col items-center justify-center gap-5 p-12 text-center">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl border border-readion-border-strong bg-readion-background-surface text-readion-accent-label"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
          </svg>
        </div>

        <div>
          <p class="mb-1.5 font-semibold text-readion-text-primary text-lg">Preparing your exam</p>
          <p class="mb-1 text-readion-text-secondary text-[13px]">Verifying question bank integrity…</p>
          <p class="text-readion-text-muted text-xs">
            The timer starts once every question is ready.
          </p>
        </div>

        <p
          class="max-w-[280px] rounded-lg border border-readion-border-strong bg-readion-background-surface px-4 py-2.5 text-readion-text-muted text-xs leading-relaxed"
        >
          Your exam is resumable within the timed window. If you close this tab, the clock keeps running.
        </p>
      </div>

      <MockExamNavPanel mode="preparing" :total="total" :ready-count="readyCount" />
    </div>
  </div>
</template>
