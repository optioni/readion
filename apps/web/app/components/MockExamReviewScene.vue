<script setup lang="ts">
import type { MockExamCitation, MockExamResponse } from '@readion/shared'
import { computed, ref } from 'vue'
import CitationChip from '~/components/CitationChip.vue'
import ExamHeader from '~/components/ExamHeader.vue'
import MockExamNavPanel from '~/components/MockExamNavPanel.vue'
import QuizOption, { type QuizOptionState } from '~/components/QuizOption.vue'
import type { ReviewOutcome } from '~/composables/examNavSquares'
import { optionRevealState } from '~/composables/examOptionState'
import { optionLetter } from '~/composables/examQuestionPosition'

const props = defineProps<{
  exam: MockExamResponse
  certCode: string
  certName?: string
}>()

const emit = defineEmits<{ back: [] }>()

const currentIndex = ref(0)

const lastIndex = computed<number>(() => Math.max(props.exam.questions.length - 1, 0))

const currentQuestion = computed(() => props.exam.questions[currentIndex.value])

const outcomes = computed<ReviewOutcome[]>(() =>
  props.exam.questions.map((question) => {
    if (question.userAnswer == null) {
      return 'skipped'
    }
    return question.userAnswer === question.correctAnswer ? 'correct' : 'incorrect'
  }),
)

function optionStateFor(option: string): QuizOptionState {
  const question = currentQuestion.value
  return optionRevealState(option, question?.userAnswer, question?.correctAnswer)
}

function citationLabel(citation: MockExamCitation): string {
  return citation.text || citation.chunkId
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
    data-testid="exam-review-scene"
    class="relative flex min-h-0 flex-1 flex-col bg-readion-background-base"
  >
    <ExamHeader
      :cert-code="certCode"
      :cert-name="certName"
      mode="review"
      :current-index="currentIndex"
      :total-questions="exam.questions.length"
      :paused="true"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div class="flex-1 overflow-y-auto px-12 py-8">
        <div v-if="currentQuestion" class="max-w-[720px]">
          <button
            type="button"
            data-testid="exam-review-back-button"
            class="mb-5 text-[13px] text-readion-accent-label"
            @click="emit('back')"
          >
            ← Back to results
          </button>

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

          <div class="mb-6 flex flex-col gap-2">
            <QuizOption
              v-for="(option, index) in currentQuestion.options"
              :key="option"
              test-id="exam-option"
              :letter="optionLetter(index)"
              :text="option"
              :state="optionStateFor(option)"
            />
          </div>

          <div
            class="mb-7 rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-5"
          >
            <div
              class="mb-3 text-[11px] text-readion-accent-label uppercase tracking-wider"
            >
              Explanation
            </div>
            <p
              data-testid="exam-explanation"
              class="text-[13px] text-readion-text-secondary leading-relaxed"
            >
              {{ currentQuestion.explanation }}
            </p>
            <div
              v-if="currentQuestion.citations?.length"
              class="mt-4 flex flex-wrap gap-1.5 border-readion-border-strong border-t pt-3"
            >
              <CitationChip
                v-for="citation in currentQuestion.citations"
                :key="citation.chunkId"
                :label="citationLabel(citation)"
              />
            </div>
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

      <MockExamNavPanel
        mode="review"
        :total="exam.questions.length"
        :current-index="currentIndex"
        :outcomes="outcomes"
        @navigate="(index) => (currentIndex = index)"
      />
    </div>
  </div>
</template>
