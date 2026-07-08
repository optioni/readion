<script setup lang="ts">
import type { MockExamResponse, SessionSummaryResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import MockExamDomainBreakdown from '~/components/MockExamDomainBreakdown.vue'
import SessionSummaryBody from '~/components/SessionSummaryBody.vue'
import { drillMockExam, fetchMockExamSummary } from '~/composables/mockExamApi'
import { mockExamQueryKeys } from '~/composables/mockExamQueryKeys'
import { deriveExamCounts, passingScorePercent } from '~/composables/mockExamResults'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { useCertDetail } from '~/composables/useCertDetail'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

const props = defineProps<{
  exam: MockExamResponse
  examId: string
}>()

const emit = defineEmits<{
  review: []
}>()

const scorePercent = computed<number>(() => Math.round((props.exam.score ?? 0) * 100))
const isExpired = computed<boolean>(() => props.exam.status === 'expired')

const { passingScore } = useCertDetail(props.exam.userCertificationId)
const passingScoreLabel = computed<number | null>(() => passingScorePercent(passingScore.value))

const examCounts = computed(() =>
  deriveExamCounts(props.exam.domainBreakdown, props.exam.questions),
)

const summaryQuery = useQuery({
  queryKey: mockExamQueryKeys.summary(props.examId),
  queryFn: () => fetchMockExamSummary(props.examId),
})

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
  if (!props.exam.startedAt || !props.exam.deadline) {
    return null
  }
  const elapsedMs =
    new Date(props.exam.deadline).getTime() - new Date(props.exam.startedAt).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return null
  }
  const totalSeconds = Math.floor(elapsedMs / 1000)
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
})

const drillNoMisses = ref(false)

async function handleDrill() {
  const result = await drillMockExam(props.examId)
  if (result.status === 'started') {
    await navigateTo(sessionRunPath(String(result.session?.id)))
    return
  }
  drillNoMisses.value = true
}

async function handleBack() {
  await navigateTo('/')
}
</script>

<template>
  <div
    data-testid="exam-results-scene"
    class="mx-auto flex w-full max-w-2xl flex-col gap-9 px-8 py-12"
  >
    <div
      data-testid="exam-score-hero"
      class="flex items-center gap-8 rounded-xl border border-readion-border-strong bg-readion-background-surface px-9 py-8"
    >
      <div class="flex-shrink-0 text-center">
        <div
          data-testid="exam-score-value"
          class="font-bold text-5xl leading-none"
          :class="exam.passed === false ? 'text-readion-status-poor' : 'text-readion-status-good'"
        >
          {{ scorePercent }}%
        </div>
        <div class="mt-1.5 text-[12px] text-readion-text-muted">overall score</div>
      </div>

      <div class="h-16 w-px flex-shrink-0 bg-readion-border-strong" />

      <div class="flex-1">
        <div class="mb-2.5 flex items-center gap-2">
          <span
            v-if="exam.passed !== null"
            data-testid="exam-pass-badge"
            class="rounded-full border px-2.5 py-0.5 font-semibold text-[12px]"
            :class="
              exam.passed
                ? 'border-readion-status-good/40 text-readion-status-good'
                : 'border-readion-status-poor/40 text-readion-status-poor'
            "
          >
            {{ exam.passed ? 'PASS' : 'FAIL' }}
          </span>
        </div>
        <div
          v-if="passingScoreLabel !== null"
          data-testid="exam-passing-score"
          class="mb-1.5 text-[13px] text-readion-text-secondary"
        >
          Passing score: {{ passingScoreLabel }}%
        </div>
        <div
          data-testid="exam-counts"
          class="mb-3 text-[13px] text-readion-text-secondary"
        >
          {{ examCounts.correct }} correct · {{ examCounts.incorrect }} incorrect ·
          {{ examCounts.unanswered }} unanswered
        </div>
        <div
          v-if="isExpired"
          data-testid="exam-autosubmit-note"
          class="mb-3 text-[13px] text-readion-text-secondary leading-relaxed"
        >
          Time ran out — this attempt was auto-submitted at the deadline.
        </div>
        <button
          type="button"
          data-testid="exam-review-button"
          class="rounded-md bg-readion-primary px-5 py-2.5 font-medium text-sm text-white"
          @click="emit('review')"
        >
          Review all answers
        </button>
      </div>
    </div>

    <MockExamDomainBreakdown :breakdown="exam.domainBreakdown" />

    <SessionSummaryBody
      v-if="summary"
      :summary="summary"
      :time-label="timeLabel"
      :drill-no-misses="drillNoMisses"
      :hide-ask-agent="true"
      @drill="handleDrill"
      @back="handleBack"
    />
  </div>
</template>
