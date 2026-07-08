<script setup lang="ts">
import { type SessionItemResponse, type SessionItemType, sessionItemTypes } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import AgentPanel from '~/components/AgentPanel.vue'
import QuizCard from '~/components/QuizCard.vue'
import ReadingBlock from '~/components/ReadingBlock.vue'
import SessionHeader from '~/components/SessionHeader.vue'
import SessionLayout from '~/components/SessionLayout.vue'
import { sessionSummaryPath } from '~/composables/runnerRoutes'
import { isEndedSessionStatus, toSessionStatus } from '~/composables/sessionLifecycle'
import { completeSessionItem, endSession, fetchSessionDetail } from '~/composables/sessionViewApi'
import { sessionViewQueryKeys } from '~/composables/sessionViewQueryKeys'
import { useElapsedTimer } from '~/composables/useElapsedTimer'
import { useSessionProgress } from '~/composables/useSessionProgress'
import type { SessionItemResponseDto } from '~~/src/api/model'

definePageMeta({ layout: 'minimal' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))

const sessionQuery = useQuery({
  queryKey: sessionViewQueryKeys.sessionDetail(sessionId.value),
  queryFn: () => fetchSessionDetail(sessionId.value),
})

const isLoading = computed(() => sessionQuery.isLoading.value)
const isError = computed(() => sessionQuery.isError.value)
const session = computed(() => sessionQuery.data.value?.data ?? null)

function narrowType(type: string): SessionItemType {
  return (sessionItemTypes as readonly string[]).includes(type)
    ? (type as SessionItemType)
    : 'reading'
}

function toItem(dto: SessionItemResponseDto): SessionItemResponse {
  return { ...dto, type: narrowType(dto.type) }
}

const items = ref<SessionItemResponse[]>([])
const currentPos = ref(0)

watch(
  session,
  (value) => {
    if (!value) {
      return
    }
    const mapped = (value.items ?? []).map(toItem)
    items.value = mapped
    const firstIncomplete = mapped.findIndex((item) => !item.completed)
    currentPos.value =
      firstIncomplete >= 0
        ? firstIncomplete
        : Math.min(value.lastItemIndex, Math.max(mapped.length - 1, 0))
  },
  { immediate: true },
)

const currentItem = computed<SessionItemResponse | null>(
  () => items.value[currentPos.value] ?? null,
)

const isEnded = computed(() =>
  session.value ? isEndedSessionStatus(toSessionStatus(session.value.status)) : false,
)

watch(
  isEnded,
  (ended) => {
    if (ended) {
      navigateTo(sessionSummaryPath(sessionId.value))
    }
  },
  { immediate: true },
)

const startedAt = computed(() => session.value?.startedAt ?? null)
const { elapsed } = useElapsedTimer(startedAt)
const { completedCount, totalCount } = useSessionProgress(items)

async function handleAdvance(index: number) {
  const target = items.value.find((item) => item.index === index)
  if (target) {
    target.completed = true
  }
  await completeSessionItem(sessionId.value, index)
  if (currentPos.value < items.value.length - 1) {
    currentPos.value += 1
  }
}

async function handleEnd() {
  await endSession(sessionId.value)
  await navigateTo(sessionSummaryPath(sessionId.value))
}
</script>

<template>
  <div data-testid="session-view-page" class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="isLoading"
      data-testid="session-view-loading"
      class="flex flex-1 items-center justify-center text-readion-text-muted text-sm"
    >
      Loading session…
    </div>

    <div
      v-else-if="isError || !session"
      data-testid="session-view-error"
      class="flex flex-1 items-center justify-center text-readion-status-warning text-sm"
    >
      This session could not be loaded.
    </div>

    <div
      v-else-if="isEnded"
      data-testid="session-view-ended"
      class="flex flex-1 items-center justify-center text-readion-text-muted text-sm"
    >
      Redirecting to the session summary…
    </div>

    <SessionLayout v-else>
      <template #header>
        <SessionHeader
          :user-certification-id="session.userCertificationId"
          :elapsed="elapsed"
          :completed-count="completedCount"
          :total-count="totalCount"
          @end="handleEnd"
        />
      </template>

      <template #content>
        <QuizCard
          v-if="currentItem && currentItem.type === 'quiz'"
          :session-id="sessionId"
          :user-certification-id="session.userCertificationId"
          :item="currentItem"
          @advance="handleAdvance"
        />
        <ReadingBlock
          v-else-if="currentItem"
          :session-id="sessionId"
          :item="currentItem"
          @advance="handleAdvance"
        />
      </template>

      <template #agent>
        <AgentPanel :session-id="sessionId" />
      </template>
    </SessionLayout>
  </div>
</template>
