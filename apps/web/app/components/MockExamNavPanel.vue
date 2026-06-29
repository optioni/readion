<script setup lang="ts">
import { computed } from 'vue'
import {
  buildExamNavSquares,
  type NavSquareState,
  type ReviewOutcome,
} from '~/composables/examNavSquares'
import { statusBorderColorClass, statusTextColorClass } from '~/composables/statusColor'

const props = defineProps<{
  mode: 'preparing' | 'active' | 'review'
  total: number
  readyCount?: number
  currentIndex?: number
  answeredIndices?: number[] | Set<number>
  outcomes?: ReviewOutcome[]
}>()

const emit = defineEmits<{ navigate: [index: number]; submit: [] }>()

const answeredSet = computed<Set<number>>(() =>
  props.answeredIndices instanceof Set
    ? props.answeredIndices
    : new Set(props.answeredIndices ?? []),
)

const squares = computed(() =>
  buildExamNavSquares({
    mode: props.mode,
    total: props.total,
    readyCount: props.readyCount,
    currentIndex: props.currentIndex,
    answeredIndices: answeredSet.value,
    outcomes: props.outcomes,
  }),
)

// Review outcomes share the same status palette as QuizOption's correct/incorrect states.
const squareClass: Record<NavSquareState, string> = {
  ready: 'border-readion-border-default bg-readion-background-elevated text-readion-text-subtle',
  unanswered: 'border-readion-border-strong bg-readion-background-surface text-readion-text-muted',
  answered: 'border-readion-primary bg-readion-primary text-white',
  current: 'border-readion-accent-label bg-readion-background-surface text-readion-accent-label',
  correct: `${statusBorderColorClass('good')} bg-readion-status-good/15 ${statusTextColorClass('good')}`,
  incorrect: `${statusBorderColorClass('poor')} bg-readion-status-poor/15 ${statusTextColorClass('poor')}`,
  skipped: 'border-readion-border-default bg-readion-background-surface text-readion-text-subtle',
}

const answeredCount = computed<number>(() => answeredSet.value.size)

const readyPercent = computed<number>(() =>
  props.total === 0 ? 0 : ((props.readyCount ?? 0) / props.total) * 100,
)

const reviewCounts = computed(() => {
  const counts = { correct: 0, incorrect: 0, skipped: 0 }
  for (const outcome of props.outcomes ?? []) {
    counts[outcome] += 1
  }
  return counts
})

const legend = computed<{ label: string; swatch: string }[]>(() =>
  props.mode === 'review'
    ? [
        { label: 'Correct', swatch: 'bg-readion-status-good' },
        { label: 'Incorrect', swatch: 'bg-readion-status-poor' },
        { label: 'Skipped', swatch: 'bg-readion-text-subtle' },
      ]
    : [
        { label: 'Answered', swatch: 'bg-readion-primary' },
        { label: 'Current', swatch: 'bg-readion-accent-label' },
      ],
)
</script>

<template>
  <aside
    data-testid="exam-nav"
    class="flex w-54 flex-shrink-0 flex-col border-readion-border-strong border-l bg-readion-background-elevated"
  >
    <div class="flex-shrink-0 border-readion-border-strong border-b px-4 pt-3.5 pb-2.5">
      <div class="flex items-center justify-between" :class="mode === 'preparing' ? 'mb-2' : ''">
        <span class="text-[11px] text-readion-text-muted uppercase tracking-wider">Questions</span>
        <span
          v-if="mode === 'preparing'"
          data-testid="exam-prepare-progress"
          class="text-[11px] text-readion-accent-label"
        >
          {{ readyCount ?? 0 }} / {{ total }} ready
        </span>
        <span v-else class="text-[11px] text-readion-text-muted">{{ total }} total</span>
      </div>
      <div
        v-if="mode === 'preparing'"
        data-testid="exam-prepare-bar"
        class="h-0.5 rounded-full bg-readion-border-strong"
      >
        <div
          class="h-full rounded-full bg-readion-accent-label transition-[width] duration-300"
          :style="{ width: `${readyPercent}%` }"
        />
      </div>
    </div>

    <div
      v-if="mode === 'active' || mode === 'review'"
      data-testid="exam-nav-legend"
      class="flex flex-wrap gap-2.5 border-readion-border-default border-b px-4 py-2"
    >
      <div v-for="item in legend" :key="item.label" class="flex items-center gap-1">
        <span class="h-2 w-2 rounded-sm" :class="item.swatch" />
        <span class="text-[10px] text-readion-text-subtle">{{ item.label }}</span>
      </div>
    </div>

    <div class="grid flex-1 grid-cols-6 content-start gap-1.5 overflow-y-auto px-4 py-3">
      <button
        v-for="square in squares"
        :key="square.index"
        type="button"
        data-testid="exam-nav-square"
        :data-state="square.state"
        class="flex h-7 w-7 items-center justify-center rounded-sm border font-mono text-[10px] font-medium"
        :class="squareClass[square.state]"
        @click="emit('navigate', square.index)"
      >
        {{ square.label }}
      </button>
    </div>

    <div
      v-if="mode === 'active'"
      class="flex flex-shrink-0 flex-col gap-2 border-readion-border-strong border-t px-4 py-3.5"
    >
      <button
        type="button"
        data-testid="exam-submit-button"
        class="w-full rounded-md bg-readion-primary py-2.5 font-medium text-[13px] text-white"
        @click="emit('submit')"
      >
        Submit exam
      </button>
      <div data-testid="exam-answered-count" class="text-center text-[11px] text-readion-text-subtle">
        {{ answeredCount }} of {{ total }} answered
      </div>
    </div>

    <div
      v-if="mode === 'review'"
      class="flex-shrink-0 border-readion-border-strong border-t px-4 py-3.5"
    >
      <div data-testid="exam-review-counts" class="flex justify-between text-xs">
        <span class="text-readion-status-good">{{ reviewCounts.correct }} correct</span>
        <span class="text-readion-status-poor">{{ reviewCounts.incorrect }} incorrect</span>
        <span class="text-readion-text-subtle">{{ reviewCounts.skipped }} skipped</span>
      </div>
    </div>
  </aside>
</template>
