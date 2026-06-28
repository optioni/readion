<script setup lang="ts">
import type { SessionItemResponse, SubmitAnswerResponse } from '@readion/shared'
import { computed, ref } from 'vue'
import ConfidenceRating from '~/components/ConfidenceRating.vue'
import QuizOption, { type QuizOptionState } from '~/components/QuizOption.vue'
import { parseSessionItemContent } from '~/composables/parseSessionItemContent'
import { reportQuizQuestion, submitQuizAnswer } from '~/composables/sessionViewApi'

const props = defineProps<{
  sessionId: string
  userCertificationId: string
  item: SessionItemResponse
}>()

const emit = defineEmits<{ advance: [index: number] }>()

const REPORT_REASON = 'Flagged as a problem during a study session'

const parsed = computed(() => parseSessionItemContent(props.item))

const shownAt = Date.now()
const selectedIndex = ref<number | null>(null)
const confidence = ref<number | undefined>(undefined)
const result = ref<SubmitAnswerResponse | null>(null)
const reported = ref(false)

const canSubmit = computed(
  () => selectedIndex.value !== null && confidence.value !== undefined && result.value === null,
)

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

function optionState(index: number): QuizOptionState {
  if (result.value === null) {
    return selectedIndex.value === index ? 'selected' : 'rest'
  }
  if (selectedIndex.value === index) {
    return result.value.correct ? 'correct' : 'incorrect'
  }
  return 'dim'
}

function selectOption(index: number) {
  if (result.value !== null) {
    return
  }
  selectedIndex.value = index
}

async function submit() {
  if (
    parsed.value.kind !== 'quiz' ||
    selectedIndex.value === null ||
    confidence.value === undefined
  ) {
    return
  }
  const answer = parsed.value.options[selectedIndex.value]
  if (answer === undefined) {
    return
  }
  result.value = await submitQuizAnswer(parsed.value.questionId, {
    userCertificationId: props.userCertificationId,
    answer,
    confidence: confidence.value,
    timeTakenMs: Date.now() - shownAt,
  })
}

async function report() {
  if (parsed.value.kind !== 'quiz') {
    return
  }
  await reportQuizQuestion(parsed.value.questionId, {
    userCertificationId: props.userCertificationId,
    reason: REPORT_REASON,
  })
  reported.value = true
}

function advance() {
  emit('advance', props.item.index)
}
</script>

<template>
  <div
    data-testid="quiz-card"
    class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-5"
  >
    <template v-if="parsed.kind === 'quiz'">
      <div class="mb-3.5 flex items-center gap-2">
        <span
          class="rounded-full border border-readion-accent-label/20 bg-readion-accent-label/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-readion-accent-label"
        >
          Question
        </span>
      </div>

      <p class="mb-4 text-readion-text-primary text-sm leading-relaxed">{{ parsed.question }}</p>

      <div class="mb-4 flex flex-col gap-1.5">
        <QuizOption
          v-for="(option, index) in parsed.options"
          :key="option"
          :letter="optionLetter(index)"
          :text="option"
          :state="optionState(index)"
          @select="selectOption(index)"
        />
      </div>

      <ConfidenceRating
        v-if="result === null"
        v-model="confidence"
        class="mb-4"
      />

      <div class="flex items-center justify-between">
        <button
          v-if="result === null"
          type="button"
          data-testid="quiz-submit-button"
          :disabled="!canSubmit"
          class="rounded-md bg-readion-primary px-5 py-2 font-medium text-sm text-white disabled:opacity-50"
          @click="submit"
        >
          Submit answer
        </button>
        <button
          v-else
          type="button"
          data-testid="quiz-continue-button"
          class="rounded-md bg-readion-primary px-5 py-2 font-medium text-sm text-white"
          @click="advance"
        >
          Continue &#8594;
        </button>

        <button
          type="button"
          data-testid="quiz-report-button"
          class="text-readion-text-subtle text-xs"
          @click="report"
        >
          {{ reported ? 'Report received — thanks' : 'Report this question' }}
        </button>
      </div>
    </template>

    <template v-else>
      <p class="mb-1 font-medium text-readion-text-primary text-sm">This question is unavailable</p>
      <p class="mb-4 text-readion-text-muted text-xs">
        We don't have enough material to ask this one yet. You can skip ahead.
      </p>
      <button
        type="button"
        data-testid="advance-item-button"
        class="rounded-md border border-readion-border-strong px-3 py-1.5 text-readion-text-muted text-xs"
        @click="advance"
      >
        Skip &#8594;
      </button>
    </template>
  </div>
</template>
