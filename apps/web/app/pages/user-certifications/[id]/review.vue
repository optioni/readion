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
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import ReviewCompletion from '~/components/ReviewCompletion.vue'
import ReviewHeader from '~/components/ReviewHeader.vue'
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
import { useReviewCountdown } from '~/composables/useReviewCountdown'
import { useTrack } from '~/composables/useTrack'
import type { SessionItemResponseDto } from '~~/src/api/model'

definePageMeta({ layout: false })

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

useTrack().track('review_started', { enrollmentId: enrollmentId.value })

const { timeStr, timeUrgent } = useReviewCountdown()

type Scene = 'queue' | 'loop' | 'completion' | 'self-grade' | 'self-grade-completion'
const scene = ref<Scene>('queue')

// The single "Start review" launches the self-grade flashcard flow by default (the design's
// single-entry model). The quiz + confidence run loop stays reachable as a secondary in-flow rating
// mode — selecting between the two paths is a property of the run loop, not a competing entry CTA.
type ReviewMode = 'self-grade' | 'quiz'
const reviewMode = ref<ReviewMode>('self-grade')

// --- Queue state ---
const queueItems = ref<ReviewItemResponse[]>([])
const dueCount = ref(0)
const isLoadingQueue = ref(false)
const isRetryingQueue = ref(false)
const queueSettled = ref(false)
const queueError = ref<string | null>(null)
const isStartingReview = ref(false)
const startReviewError = ref<string | null>(null)

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
const pendingGrade = ref<ReviewGrade | null>(null)
const selfGradeBreakdown = ref<Record<ReviewGrade, number>>({
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
})

const currentSelfGradeItem = computed(() => selfGradeItems.value[selfGradePos.value] ?? null)
const queueLoading = computed(() => !queueSettled.value || isLoadingQueue.value)

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
async function loadQueue(retrying = false): Promise<boolean> {
  if (isLoadingQueue.value || isRetryingQueue.value) {
    return false
  }

  if (retrying) {
    isRetryingQueue.value = true
  } else {
    isLoadingQueue.value = true
  }

  try {
    const queue = await fetchReviewQueue(enrollmentId.value)
    queueItems.value = queue.items
    dueCount.value = queue.meta.dueCount
    queueError.value = null
    return true
  } catch {
    queueError.value = 'Couldn’t load your review queue.'
    return false
  } finally {
    queueSettled.value = true
    isLoadingQueue.value = false
    isRetryingQueue.value = false
  }
}

onMounted(async () => {
  const loaded = await loadQueue()
  if (loaded && route.query.autostart === '1') {
    await handleStart()
  }
})

// --- Run-loop entry ---
async function handleStart() {
  if (isStartingReview.value) return
  isStartingReview.value = true
  startReviewError.value = null
  try {
    const result = await startReview(enrollmentId.value)
    if (result.status === 'all_caught_up') {
      dueCount.value = 0
      return
    }
    const sessionId = String(result.session.id)
    activeSessionId.value = sessionId

    if (reviewMode.value === 'quiz') {
      const detail = await fetchSessionDetail(sessionId)
      items.value = (detail.data.items ?? []).map(toItem)
      currentPos.value = 0
      scene.value = 'loop'
      return
    }

    enterSelfGradeFlow()
  } catch {
    startReviewError.value = 'Couldn’t start review. Try again.'
  } finally {
    isStartingReview.value = false
  }
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
function enterSelfGradeFlow() {
  selfGradeItems.value = [...queueItems.value]
  selfGradePos.value = 0
  selfGradeRevealed.value = false
  selfGradeBreakdown.value = { again: 0, hard: 0, good: 0, easy: 0 }
  scene.value = 'self-grade'
}

async function handleGrade(grade: ReviewGrade) {
  if (pendingGrade.value) return
  const item = currentSelfGradeItem.value
  if (!item) return
  pendingGrade.value = grade
  try {
    await gradeReviewItem(item.id, grade)
    selfGradeBreakdown.value[grade] += 1
    if (selfGradePos.value < selfGradeItems.value.length - 1) {
      selfGradePos.value += 1
      selfGradeRevealed.value = false
    } else {
      scene.value = 'self-grade-completion'
    }
  } finally {
    pendingGrade.value = null
  }
}

// --- Header progress ---
const headerCurrent = computed<number>(() => {
  switch (scene.value) {
    case 'self-grade':
      return selfGradePos.value
    case 'self-grade-completion':
      return selfGradeItems.value.length
    case 'loop':
      return currentPos.value
    case 'completion':
      return items.value.length
    default:
      return 0
  }
})

const headerTotal = computed<number>(() => {
  switch (scene.value) {
    case 'self-grade':
    case 'self-grade-completion':
      return selfGradeItems.value.length
    case 'loop':
    case 'completion':
      return items.value.length
    default:
      return dueCount.value
  }
})
</script>

<template>
  <div class="flex h-screen flex-col bg-readion-background-base">
    <ReviewHeader
      :user-certification-id="enrollmentId"
      :current="headerCurrent"
      :total="headerTotal"
      :time-str="timeStr"
      :time-urgent="timeUrgent"
    />

    <div
      data-testid="review-page"
      class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-8"
    >
      <template v-if="scene === 'queue'">
        <div
          data-testid="review-queue-region"
          :aria-busy="queueLoading || isRetryingQueue ? 'true' : undefined"
        >
          <ReadionAsyncRegion
            :loading="queueLoading"
            :error="queueError ?? undefined"
            :retrying="isRetryingQueue"
            loading-label="Loading review queue…"
            retrying-label="Retrying…"
            aria-label="Review queue"
            @retry="loadQueue(true)"
          >
            <template #loading>
              <div
                class="mx-auto h-72 w-full max-w-md animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
                aria-hidden="true"
              />
            </template>
            <template #error>
              <span data-testid="review-queue-error" role="alert">{{ queueError }}</span>
            </template>

            <ReviewQueueEntry
              :enrollment-id="enrollmentId"
              :items="queueItems"
              :due-count="dueCount"
              :starting="isStartingReview"
              @start="handleStart"
            />

            <p
              v-if="startReviewError"
              data-testid="review-start-error"
              class="mt-4 text-center text-readion-status-poor text-sm"
              role="alert"
            >
              {{ startReviewError }}
            </p>

            <div
              v-if="dueCount > 0"
              data-testid="review-mode-toggle"
              role="group"
              aria-label="Optional rating mode — self-grade is the default, quiz stays reachable"
              class="flex items-center justify-end gap-2 text-readion-text-subtle text-xs"
            >
              <span>Prefer quiz instead?</span>
              <ReadionButton
                data-testid="review-mode-self-grade"
                variant="toggle"
                :selected="reviewMode === 'self-grade'"
                :disabled="isStartingReview"
                class="!min-h-0 px-1.5 py-0.5 text-xs"
                @click="reviewMode = 'self-grade'"
              >
                Self-grade
              </ReadionButton>
              <ReadionButton
                data-testid="review-mode-quiz"
                variant="toggle"
                :selected="reviewMode === 'quiz'"
                :disabled="isStartingReview"
                class="!min-h-0 px-1.5 py-0.5 text-xs"
                @click="reviewMode = 'quiz'"
              >
                Quiz
              </ReadionButton>
            </div>
          </ReadionAsyncRegion>
        </div>
      </template>

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

        <ReadionButton
          v-if="!selfGradeRevealed"
          data-testid="reveal-button"
          variant="secondary"
          class="w-full px-5 py-2.5"
          @click="selfGradeRevealed = true"
        >
          Reveal
        </ReadionButton>

        <div
          v-else
          class="flex gap-3"
        >
          <ReadionButton
            data-testid="grade-again"
            variant="secondary"
            :busy="pendingGrade === 'again'"
            busy-label="Saving…"
            :disabled="pendingGrade !== null && pendingGrade !== 'again'"
            class="flex-1 px-3 py-2 text-readion-status-poor hover:border-readion-status-poor"
            @click="handleGrade('again')"
          >
            Again
          </ReadionButton>
          <ReadionButton
            data-testid="grade-hard"
            variant="secondary"
            :busy="pendingGrade === 'hard'"
            busy-label="Saving…"
            :disabled="pendingGrade !== null && pendingGrade !== 'hard'"
            class="flex-1 px-3 py-2 text-readion-status-warning hover:border-readion-status-warning"
            @click="handleGrade('hard')"
          >
            Hard
          </ReadionButton>
          <ReadionButton
            data-testid="grade-good"
            variant="secondary"
            :busy="pendingGrade === 'good'"
            busy-label="Saving…"
            :disabled="pendingGrade !== null && pendingGrade !== 'good'"
            class="flex-1 px-3 py-2 text-readion-status-good hover:border-readion-status-good"
            @click="handleGrade('good')"
          >
            Good
          </ReadionButton>
          <ReadionButton
            data-testid="grade-easy"
            variant="secondary"
            :busy="pendingGrade === 'easy'"
            busy-label="Saving…"
            :disabled="pendingGrade !== null && pendingGrade !== 'easy'"
            class="flex-1 bg-readion-status-good/10 px-3 py-2 text-readion-status-good hover:bg-readion-status-good/20"
            @click="handleGrade('easy')"
          >
            Easy
          </ReadionButton>
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

        <ReadionButton
          variant="secondary"
          class="w-full px-5 py-2.5"
          @click="scene = 'queue'"
        >
          Back to queue
        </ReadionButton>
      </div>
    </div>
  </div>
</template>
