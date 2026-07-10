<script setup lang="ts">
import type { SessionSummaryResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import SessionSummaryContent from '~/components/SessionSummaryContent.vue'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { toSummary } from '~/composables/sessionSummaryMapper'
import { drillSession, fetchSessionDetail, fetchSessionSummary } from '~/composables/sessionViewApi'
import { sessionViewQueryKeys } from '~/composables/sessionViewQueryKeys'
import { elapsedMs } from '~/composables/useElapsedTimer'
import { useTrack } from '~/composables/useTrack'

definePageMeta({ layout: 'default' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))

const summaryQuery = useQuery({
  queryKey: sessionViewQueryKeys.sessionSummary(sessionId.value),
  queryFn: () => fetchSessionSummary(sessionId.value),
})

const sessionQuery = useQuery({
  queryKey: sessionViewQueryKeys.sessionDetail(sessionId.value),
  queryFn: () => fetchSessionDetail(sessionId.value),
})

const isLoading = computed(() => summaryQuery.isLoading.value || sessionQuery.isLoading.value)
const isError = computed(() => summaryQuery.isError.value || sessionQuery.isError.value)

const summary = computed<SessionSummaryResponse | null>(() => {
  const dto = summaryQuery.data.value
  return dto ? toSummary(dto) : null
})

const userCertificationId = computed<string | null>(
  () => sessionQuery.data.value?.data.userCertificationId ?? null,
)

const completedAt = computed<string | null>(() => {
  const endedAt = sessionQuery.data.value?.data.endedAt
  return endedAt ? String(endedAt) : null
})

const { track } = useTrack()
const completedTracked = ref(false)
watch(
  summary,
  (value) => {
    if (value && !completedTracked.value) {
      completedTracked.value = true
      track('session_completed', { itemCount: value.questionsAnswered })
    }
  },
  { immediate: true },
)

const timeLabel = computed<string | null>(() => {
  const session = sessionQuery.data.value?.data
  const ms = elapsedMs(
    session?.startedAt ?? null,
    session?.endedAt ? String(session.endedAt) : null,
  )
  if (ms === null) {
    return null
  }
  const totalSeconds = Math.floor(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
})

const drillNoMisses = ref(false)

async function handleDrill() {
  const result = await drillSession(sessionId.value)
  if (result.status === 'started') {
    await navigateTo(sessionRunPath(String(result.session?.id)))
    return
  }
  drillNoMisses.value = true
}

async function handleAskAgent(responseId: string) {
  await navigateTo({ path: sessionRunPath(sessionId.value), query: { explain: responseId } })
}

async function handleBack() {
  await navigateTo('/')
}
</script>

<template>
  <div data-testid="session-summary-page" class="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-9 py-7">
    <div
      v-if="isLoading"
      data-testid="session-summary-loading"
      class="flex flex-1 items-center justify-center text-readion-text-muted text-sm"
    >
      Loading summary…
    </div>

    <div
      v-else-if="isError || !summary || !userCertificationId"
      data-testid="session-summary-error"
      class="flex flex-1 items-center justify-center text-readion-status-warning text-sm"
    >
      This summary could not be loaded.
    </div>

    <SessionSummaryContent
      v-else
      :user-certification-id="userCertificationId ?? ''"
      :summary="summary"
      :time-label="timeLabel"
      :completed-at="completedAt"
      :drill-no-misses="drillNoMisses"
      @drill="handleDrill"
      @ask-agent="handleAskAgent"
      @back="handleBack"
    />
  </div>
</template>
