<script setup lang="ts">
import {
  type ReviewGrade,
  type ReviewItemResponse,
  type SessionItemResponse,
  type SessionItemType,
  type SessionSummaryResponse,
  sessionItemTypes,
} from '@readion/shared'
import { computed, onMounted, ref } from 'vue'
import QuizCard from '~/components/QuizCard.vue'
import ReviewCompletion from '~/components/ReviewCompletion.vue'
import ReviewQueueEntry from '~/components/ReviewQueueEntry.vue'
import { fetchReviewQueue, gradeReviewItem, startReview } from '~/composables/progressApi'
import { toSummary } from '~/composables/sessionSummaryMapper'
import {
  completeSessionItem,
  drillSession,
  endSession,
  fetchSessionDetail,
  fetchSessionSummary,
} from '~/composables/sessionViewApi'
import type { SessionItemResponseDto } from '~~/src/api/model'

definePageMeta({ layout: 'minimal' })

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

type Scene = 'queue' | 'loop' | 'completion' | 'self-grade' | 'self-grade-completion'
const scene = ref<Scene>('queue')

// --- Queue state ---
const queueItems = ref<ReviewItemResponse[]>([])
const dueCount = ref(0)

// --- Quiz loop state ---
const activeSessionId = ref<string | null>(null)
const items = ref<SessionItemResponse[]>([])
const currentPos = ref(0)
const summary = ref<SessionSummaryResponse | null>(null)
const drillNoMisses = ref(false)

const currentItem = computed<SessionItemResponse | null>(
  () => items.value[currentPos.value] ?? null,
)

// --- Self-grade state ---
const selfGradeItems = ref<ReviewItemResponse[]>([])
const selfGradePos = ref(0)
const selfGradeRevealed = ref(false)
const selfGradeBreakdown = ref<Record<ReviewGrade, number>>({
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
})

const currentSelfGradeItem = computed(() => selfGradeItems.value[selfGradePos.value] ?? null)

// --- Utilities ---
function narrowType(type: string): SessionItemType {
  return (sessionItemTypes as readonly string[]).includes(type)
    ? (type as SessionItemType)
    : 'reading'
}

function toItem(dto: SessionItemResponseDto): SessionItemResponse {
  return { ...dto, type: narrowType(dto.type) }
}

// --- Lifecycle ---
onMounted(async () => {
  const queue = await fetchReviewQueue(enrollmentId.value)
  queueItems.value = queue.items
  dueCount.value = queue.meta.dueCount
})

// --- Quiz loop handlers ---
async function handleStart() {
  const result = await startReview(enrollmentId.value)
  if (result.status === 'all_caught_up') {
    dueCount.value = 0
    return
  }
  const sessionId = String(result.session.id)
  activeSessionId.value = sessionId
  const detail = await fetchSessionDetail(sessionId)
  const mapped = (detail.data.items ?? []).map(toItem)
  items.value = mapped
  currentPos.value = 0
  scene.value = 'loop'
}

async function handleAdvance(index: number) {
  const target = items.value.find((item) => item.index === index)
  if (target) {
    target.completed = true
  }
  await completeSessionItem(activeSessionId.value!, index)

  if (currentPos.value < items.value.length - 1) {
    currentPos.value += 1
  } else {
    const sessionId = activeSessionId.value!
    await endSession(sessionId)
    const summaryDto = await fetchSessionSummary(sessionId)
    summary.value = toSummary(summaryDto)
    scene.value = 'completion'
  }
}

async function handleDrill() {
  const result = await drillSession(activeSessionId.value!)
  if (result.status === 'started') {
    activeSessionId.value = String(result.session?.id)
    for (const item of items.value) {
      item.completed = false
    }
    currentPos.value = 0
    drillNoMisses.value = false
    scene.value = 'loop'
  } else {
    drillNoMisses.value = true
    scene.value = 'completion'
  }
}

async function handleBack() {
  await navigateTo('/')
}

// --- Self-grade handlers ---
function handleStartSelfGrade() {
  selfGradeItems.value = [...queueItems.value]
  selfGradePos.value = 0
  selfGradeRevealed.value = false
  selfGradeBreakdown.value = { again: 0, hard: 0, good: 0, easy: 0 }
  scene.value = 'self-grade'
}

async function handleGrade(grade: ReviewGrade) {
  const item = currentSelfGradeItem.value
  if (!item) return
  await gradeReviewItem(item.id, grade)
  selfGradeBreakdown.value[grade] += 1
  if (selfGradePos.value < selfGradeItems.value.length - 1) {
    selfGradePos.value += 1
    selfGradeRevealed.value = false
  } else {
    scene.value = 'self-grade-completion'
  }
}
</script>

<template>
  <div
    data-testid="review-page"
    class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8"
  >
    <ReviewQueueEntry
      v-if="scene === 'queue'"
      :enrollment-id="enrollmentId"
      :items="queueItems"
      :due-count="dueCount"
      @start="handleStart"
    />

    <template v-else-if="scene === 'loop'">
      <QuizCard
        v-if="currentItem && currentItem.type === 'quiz'"
        :session-id="activeSessionId!"
        :user-certification-id="enrollmentId"
        :item="currentItem"
        @advance="handleAdvance"
      />
    </template>

    <ReviewCompletion
      v-else-if="scene === 'completion' && summary"
      :summary="summary"
      :drill-no-misses="drillNoMisses"
      @drill="handleDrill"
      @back="handleBack"
    />

    <div
      v-else-if="scene === 'self-grade' && currentSelfGradeItem"
      data-testid="self-grade-card"
      class="flex flex-col gap-6 rounded-xl border border-readion-border-strong bg-readion-background-surface px-8 py-8"
    >
      <div>
        <p class="mb-1 text-[11px] text-readion-text-muted uppercase tracking-wider">Domain</p>
        <p class="font-semibold text-readion-text-primary">{{ currentSelfGradeItem.domain }}</p>
      </div>

      <button
        v-if="!selfGradeRevealed"
        type="button"
        data-testid="reveal-button"
        class="w-full rounded-md border border-readion-border-strong px-5 py-2.5 text-readion-text-secondary text-sm hover:border-readion-primary hover:text-readion-primary"
        @click="selfGradeRevealed = true"
      >
        Reveal
      </button>

      <div
        v-else
        class="flex gap-3"
      >
        <button
          type="button"
          data-testid="grade-again"
          class="flex-1 rounded-md border border-readion-border-strong px-3 py-2 text-readion-status-poor text-sm hover:border-readion-status-poor"
          @click="handleGrade('again')"
        >
          Again
        </button>
        <button
          type="button"
          data-testid="grade-hard"
          class="flex-1 rounded-md border border-readion-border-strong px-3 py-2 text-readion-status-warning text-sm hover:border-readion-status-warning"
          @click="handleGrade('hard')"
        >
          Hard
        </button>
        <button
          type="button"
          data-testid="grade-good"
          class="flex-1 rounded-md border border-readion-border-strong px-3 py-2 text-readion-status-good text-sm hover:border-readion-status-good"
          @click="handleGrade('good')"
        >
          Good
        </button>
        <button
          type="button"
          data-testid="grade-easy"
          class="flex-1 rounded-md bg-readion-status-good/10 px-3 py-2 text-readion-status-good text-sm hover:bg-readion-status-good/20"
          @click="handleGrade('easy')"
        >
          Easy
        </button>
      </div>
    </div>

    <div
      v-else-if="scene === 'self-grade-completion'"
      data-testid="self-grade-completion"
      class="flex flex-col gap-6 rounded-xl border border-readion-border-strong bg-readion-background-surface px-8 py-8"
    >
      <div>
        <p class="mb-1 font-semibold text-readion-text-primary">
          Self-grade complete — {{ selfGradeItems.length }} items reviewed
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <p class="mb-1 text-[11px] text-readion-text-muted uppercase tracking-wider">Breakdown</p>
        <div class="flex items-center justify-between text-sm">
          <span class="text-readion-status-poor">Again</span>
          <span
            data-testid="self-grade-count-again"
            class="font-medium text-readion-text-primary"
          >{{ selfGradeBreakdown.again }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-readion-status-warning">Hard</span>
          <span
            data-testid="self-grade-count-hard"
            class="font-medium text-readion-text-primary"
          >{{ selfGradeBreakdown.hard }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-readion-status-good">Good</span>
          <span
            data-testid="self-grade-count-good"
            class="font-medium text-readion-text-primary"
          >{{ selfGradeBreakdown.good }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-readion-status-good">Easy</span>
          <span
            data-testid="self-grade-count-easy"
            class="font-medium text-readion-text-primary"
          >{{ selfGradeBreakdown.easy }}</span>
        </div>
      </div>

      <button
        type="button"
        class="w-full rounded-md border border-readion-border-strong px-5 py-2.5 text-readion-text-secondary text-sm hover:border-readion-primary hover:text-readion-primary"
        @click="scene = 'queue'"
      >
        Back to queue
      </button>
    </div>
  </div>
</template>
