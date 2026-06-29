<script setup lang="ts">
import {
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
import { fetchReviewQueue, startReview } from '~/composables/progressApi'
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

type Scene = 'queue' | 'loop' | 'completion'
const scene = ref<Scene>('queue')

const queueItems = ref<ReviewItemResponse[]>([])
const dueCount = ref(0)

const activeSessionId = ref<string | null>(null)
const items = ref<SessionItemResponse[]>([])
const currentPos = ref(0)

const summary = ref<SessionSummaryResponse | null>(null)
const drillNoMisses = ref(false)

function narrowType(type: string): SessionItemType {
  return (sessionItemTypes as readonly string[]).includes(type)
    ? (type as SessionItemType)
    : 'reading'
}

function toItem(dto: SessionItemResponseDto): SessionItemResponse {
  return { ...dto, type: narrowType(dto.type) }
}

onMounted(async () => {
  const queue = await fetchReviewQueue(enrollmentId.value)
  queueItems.value = queue.items
  dueCount.value = queue.meta.dueCount
})

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

const currentItem = computed<SessionItemResponse | null>(
  () => items.value[currentPos.value] ?? null,
)

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
  </div>
</template>
