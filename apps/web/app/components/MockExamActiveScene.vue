<script setup lang="ts">
import type { MockExamResponse } from '@readion/shared'
import { computed, ref, toRef } from 'vue'
import ExamHeader from '~/components/ExamHeader.vue'
import MockExamNavPanel from '~/components/MockExamNavPanel.vue'
import QuizOption, { type QuizOptionState } from '~/components/QuizOption.vue'
import { optionRevealState } from '~/composables/examOptionState'
import { firstUnansweredIndex, optionLetter } from '~/composables/examQuestionPosition'
import { useDeadlineCountdown } from '~/composables/useDeadlineCountdown'
import { useMockExamAnswers } from '~/composables/useMockExamAnswers'
import { useMockExamSubmit } from '~/composables/useMockExamSubmit'

const props = defineProps<{
  exam: MockExamResponse
  examId: string
  certCode: string
  certName?: string
}>()

const URGENT_THRESHOLD_SECONDS = 300

const currentIndex = ref(firstUnansweredIndex(props.exam.questions))

const { answeredIndices, answerFor, recordAnswer } = useMockExamAnswers(
  props.examId,
  props.exam.questions,
)

const { confirmOpen, requestSubmit, cancelSubmit, confirmSubmit, autoSubmit } = useMockExamSubmit(
  props.examId,
)

const unansweredCount = computed<number>(
  () => props.exam.questions.length - answeredIndices.value.length,
)

const deadline = toRef(props.exam, 'deadline')
const remainingSeconds = toRef(props.exam, 'remainingSeconds')
const { remaining, paused } = useDeadlineCountdown(deadline, remainingSeconds, () => {
  void autoSubmit()
})

// `remaining` is `HH:MM:SS`; flag the timer urgent only inside the final five minutes (paused renders
// the `--:--:--` placeholder, which parses to NaN and is treated as not-urgent).
const urgent = computed<boolean>(() => {
  const [hours, minutes, seconds] = remaining.value.split(':').map(Number)
  if (hours === undefined || minutes === undefined || seconds === undefined) {
    return false
  }
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return false
  }
  return hours === 0 && minutes * 60 + seconds <= URGENT_THRESHOLD_SECONDS
})

const lastIndex = computed<number>(() => Math.max(props.exam.questions.length - 1, 0))

const currentQuestion = computed(() => props.exam.questions[currentIndex.value])

function optionStateFor(option: string): QuizOptionState {
  return optionRevealState(option, answerFor(currentIndex.value))
}

async function handleSelect(option: string): Promise<void> {
  await recordAnswer(currentIndex.value, option)
}

function goPrevious(): void {
  currentIndex.value = Math.max(currentIndex.value - 1, 0)
}

function goNext(): void {
  currentIndex.value = Math.min(currentIndex.value + 1, lastIndex.value)
}
</script>

<template>
  <div
    data-testid="exam-active-scene"
    class="relative flex min-h-0 flex-1 flex-col bg-readion-background-base"
  >
    <ExamHeader
      :cert-code="certCode"
      :cert-name="certName"
      mode="active"
      :current-index="currentIndex"
      :total-questions="exam.questions.length"
      :timer="remaining"
      :paused="paused"
      :urgent="urgent"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div class="flex-1 overflow-y-auto px-12 py-8">
        <div v-if="currentQuestion" class="max-w-[720px]">
          <div
            data-testid="exam-domain-tag"
            class="mb-5 inline-flex items-center gap-1.5 rounded-full border border-readion-accent-label/15 bg-readion-accent-label/10 px-2.5 py-0.5 text-[10px] text-readion-accent-label uppercase tracking-wider"
          >
            {{ currentQuestion.domain }}
          </div>

          <p
            data-testid="exam-question-stem"
            class="mb-7 text-readion-text-primary text-base leading-relaxed"
          >
            {{ currentQuestion.question }}
          </p>

          <div class="mb-8 flex flex-col gap-2">
            <QuizOption
              v-for="(option, index) in currentQuestion.options"
              :key="option"
              test-id="exam-option"
              :letter="optionLetter(index)"
              :text="option"
              :state="optionStateFor(option)"
              @select="handleSelect(option)"
            />
          </div>

          <div class="flex items-center justify-between">
            <button
              type="button"
              data-testid="exam-prev-button"
              class="rounded-md border border-readion-border-strong px-4 py-2 text-[13px] text-readion-text-secondary"
              @click="goPrevious"
            >
              ← Previous
            </button>
            <div class="flex items-center gap-3">
              <button
                type="button"
                data-testid="exam-skip-button"
                class="text-[13px] text-readion-text-muted"
                @click="goNext"
              >
                Skip
              </button>
              <button
                type="button"
                data-testid="exam-next-button"
                class="rounded-md bg-readion-primary px-5 py-2 font-medium text-[13px] text-white"
                @click="goNext"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      <MockExamNavPanel
        mode="active"
        :total="exam.questions.length"
        :current-index="currentIndex"
        :answered-indices="answeredIndices"
        @navigate="(index) => (currentIndex = index)"
        @submit="requestSubmit"
      />
    </div>

    <div
      v-if="confirmOpen"
      class="absolute inset-0 z-10 flex items-center justify-center bg-readion-background-base/70 p-6"
    >
      <div
        data-testid="exam-submit-confirm"
        class="w-full max-w-[420px] rounded-xl border border-readion-border-strong bg-readion-surface p-6"
      >
        <h2 class="mb-2 font-medium text-base text-readion-text-primary">Submit exam?</h2>
        <p class="mb-5 text-[13px] text-readion-text-secondary leading-relaxed">
          You have
          <span class="font-medium text-readion-text-primary">{{ unansweredCount }}</span>
          unanswered {{ unansweredCount === 1 ? 'question' : 'questions' }}. Unanswered questions
          are scored as incorrect and cannot be changed after you submit.
        </p>
        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            data-testid="exam-submit-cancel-button"
            class="rounded-md border border-readion-border-strong px-4 py-2 text-[13px] text-readion-text-secondary"
            @click="cancelSubmit"
          >
            Keep going
          </button>
          <button
            type="button"
            data-testid="exam-submit-confirm-button"
            class="rounded-md bg-readion-primary px-5 py-2 font-medium text-[13px] text-white"
            @click="confirmSubmit"
          >
            Submit exam
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
