<script setup lang="ts">
import type { SessionSummaryResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import SessionSummaryBody from '~/components/SessionSummaryBody.vue'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { drillSession, fetchSessionDetail, fetchSessionSummary } from '~/composables/sessionViewApi'
import { sessionViewQueryKeys } from '~/composables/sessionViewQueryKeys'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

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

const isLoading = computed(() => summaryQuery.isLoading.value)
const isError = computed(() => summaryQuery.isError.value)

function toSummary(dto: SessionSummaryResponseDto): SessionSummaryResponse {
  const { before, after, delta } = dto.readiness
  return {
    questionsAnswered: dto.questionsAnswered,
    accuracy: dto.accuracy,
    domains: dto.domains.map((domain) => ({ domain: domain.domain, accuracy: domain.accuracy })),
    weakAreaDeltas: dto.weakAreaDeltas.map((area) => ({ domain: area.domain, delta: area.delta })),
    readiness: {
      before: before == null ? null : Number(before),
      after: after == null ? null : Number(after),
      delta: delta == null ? null : Number(delta),
    },
    strongestQuestion: dto.strongestQuestion ?? null,
    weakestQuestion: dto.weakestQuestion ?? null,
    nextFocus: dto.nextFocus ? { domain: String(dto.nextFocus.domain) } : null,
  }
}

const summary = computed<SessionSummaryResponse | null>(() => {
  const dto = summaryQuery.data.value
  return dto ? toSummary(dto) : null
})

const timeLabel = computed<string | null>(() => {
  const session = sessionQuery.data.value?.data
  if (!session?.startedAt || !session?.endedAt) {
    return null
  }
  const elapsedMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return null
  }
  const totalSeconds = Math.floor(elapsedMs / 1000)
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
  <div data-testid="session-summary-page" class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-9 py-7">
    <div
      v-if="isLoading"
      data-testid="session-summary-loading"
      class="flex flex-1 items-center justify-center text-readion-text-muted text-sm"
    >
      Loading summary…
    </div>

    <div
      v-else-if="isError || !summary"
      data-testid="session-summary-error"
      class="flex flex-1 items-center justify-center text-readion-status-warning text-sm"
    >
      This summary could not be loaded.
    </div>

    <SessionSummaryBody
      v-else
      :summary="summary"
      :time-label="timeLabel"
      :drill-no-misses="drillNoMisses"
      @drill="handleDrill"
      @ask-agent="handleAskAgent"
      @back="handleBack"
    />
  </div>
</template>
