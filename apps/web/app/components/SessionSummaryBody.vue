<script setup lang="ts">
import type { SessionSummaryResponse } from '@readion/shared'
import { computed } from 'vue'
import DeltaBadge from '~/components/DeltaBadge.vue'
import { formatReadiness } from '~/composables/readinessFormat'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'

const props = withDefaults(
  defineProps<{
    summary: SessionSummaryResponse
    timeLabel?: string | null
    drillNoMisses?: boolean
    hideAskAgent?: boolean
  }>(),
  { timeLabel: null, drillNoMisses: false, hideAskAgent: false },
)

const emit = defineEmits<{
  drill: []
  'ask-agent': [responseId: string]
  back: []
}>()

const accuracyPercent = computed(() => Math.round(props.summary.accuracy * 100))
const correctCount = computed(() =>
  Math.round(props.summary.accuracy * props.summary.questionsAnswered),
)

const domainDeltas = computed(
  () => new Map(props.summary.weakAreaDeltas.map((area) => [area.domain, area.delta])),
)

interface DomainRow {
  domain: string
  percent: number
  colorClass: string
  delta: number | null
}

const domainRows = computed<DomainRow[]>(() =>
  props.summary.domains.map((domain) => {
    const percent = Math.round(domain.accuracy * 100)
    const delta = domainDeltas.value.get(domain.domain)
    return {
      domain: domain.domain,
      percent,
      colorClass: statusTextColorClass(statusColorForScore(percent)),
      delta: delta ?? null,
    }
  }),
)

const hasAnsweredQuestions = computed(() => props.summary.questionsAnswered > 0)

const readiness = computed(() => {
  const { before, after, delta } = props.summary.readiness
  if (before === null || after === null) {
    return { calibrated: false as const }
  }
  return {
    calibrated: true as const,
    before,
    after,
    delta: formatReadiness({ calibrated: true, score: after }, delta).delta,
  }
})
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <div
      v-if="!hasAnsweredQuestions"
      data-testid="summary-empty-state"
      class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-8 text-center text-readion-text-secondary text-sm"
    >
      No questions answered this session.
    </div>

    <template v-if="hasAnsweredQuestions">
      <div
        class="flex overflow-hidden rounded-xl border border-readion-border-strong bg-readion-background-surface"
      >
        <div data-testid="summary-accuracy" class="flex-1 border-readion-border-strong border-r px-5 py-4">
          <div class="mb-1.5 text-[11px] text-readion-text-muted uppercase tracking-wider">Accuracy</div>
          <div class="font-bold text-2xl text-readion-text-primary leading-none">{{ accuracyPercent }}%</div>
          <div class="mt-1 text-[11px] text-readion-text-subtle">{{ correctCount }}/{{ summary.questionsAnswered }} correct</div>
        </div>
        <div
          data-testid="summary-readiness"
          class="flex-1 px-5 py-4"
          :class="timeLabel ? 'border-readion-border-strong border-r' : ''"
        >
          <div class="mb-1.5 text-[11px] text-readion-text-muted uppercase tracking-wider">Readiness</div>
          <template v-if="readiness.calibrated">
            <div class="font-bold text-2xl text-readion-status-good leading-none">{{ readiness.delta }}</div>
            <div class="mt-1 text-[11px] text-readion-text-subtle">
              {{ readiness.before }}% → {{ readiness.after }}%
            </div>
          </template>
          <template v-else>
            <div class="text-readion-text-secondary text-sm leading-snug">Readiness not yet calibrated</div>
          </template>
        </div>
        <div v-if="timeLabel" class="flex-1 px-5 py-4">
          <div class="mb-1.5 text-[11px] text-readion-text-muted uppercase tracking-wider">Time</div>
          <div class="font-bold text-2xl text-readion-text-primary leading-none">{{ timeLabel }}</div>
        </div>
      </div>

      <div
        data-testid="summary-domains"
        class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-5"
      >
        <div class="mb-3.5 text-[11px] text-readion-text-muted uppercase tracking-widest">Domains covered</div>
        <div class="flex flex-col">
          <div
            v-for="row in domainRows"
            :key="row.domain"
            class="flex items-center gap-3 border-readion-border-default border-b py-2.5 last:border-b-0"
          >
            <div class="min-w-0 flex-1 truncate text-readion-text-secondary text-[13px]">{{ row.domain }}</div>
            <div class="w-9 flex-shrink-0 text-right font-semibold text-[13px]" :class="row.colorClass">{{ row.percent }}%</div>
            <div class="w-12 flex-shrink-0">
              <DeltaBadge v-if="row.delta !== null" :value="row.delta" />
            </div>
          </div>
        </div>
      </div>

      <div
        class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-5"
      >
        <div class="mb-3.5 text-[11px] text-readion-text-muted uppercase tracking-widest">Weak area movement</div>
        <div class="flex flex-col gap-2.5">
          <div
            v-for="area in summary.weakAreaDeltas"
            :key="area.domain"
            data-testid="weak-area-delta"
            class="flex items-center gap-2.5"
          >
            <div class="flex-1 text-[13px] text-readion-text-secondary">{{ area.domain }}</div>
            <DeltaBadge :value="area.delta" />
          </div>
        </div>
      </div>
    </template>

    <div class="flex gap-3.5">
      <div
        v-if="summary.strongestQuestion"
        data-testid="summary-strongest"
        class="flex flex-1 flex-col gap-3 rounded-xl border border-readion-status-good/20 bg-readion-status-good/[0.06] px-5 py-4"
      >
        <div class="text-[11px] text-readion-status-good uppercase tracking-wider">Strongest</div>
        <p class="text-[13px] text-readion-text-secondary leading-relaxed">{{ summary.strongestQuestion.question }}</p>
        <button
          v-if="!hideAskAgent"
          type="button"
          data-testid="ask-agent-button"
          class="self-start rounded-full border border-readion-status-good/20 px-3 py-1 text-[12px] text-readion-status-good"
          @click="emit('ask-agent', summary.strongestQuestion.responseId)"
        >
          Ask agent about this
        </button>
      </div>

      <div
        v-if="summary.weakestQuestion"
        data-testid="summary-weakest"
        class="flex flex-1 flex-col gap-3 rounded-xl border border-readion-status-poor/20 bg-readion-status-poor/[0.06] px-5 py-4"
      >
        <div class="text-[11px] text-readion-status-poor uppercase tracking-wider">Weakest</div>
        <p class="text-[13px] text-readion-text-secondary leading-relaxed">{{ summary.weakestQuestion.question }}</p>
        <button
          v-if="!hideAskAgent"
          type="button"
          data-testid="ask-agent-button"
          class="self-start rounded-full border border-readion-status-poor/20 px-3 py-1 text-[12px] text-readion-status-poor"
          @click="emit('ask-agent', summary.weakestQuestion.responseId)"
        >
          Ask agent about this
        </button>
      </div>
    </div>

    <div
      v-if="summary.nextFocus"
      data-testid="summary-next-focus"
      class="rounded-xl border border-readion-accent-label/20 bg-readion-accent-label/[0.06] px-5 py-4"
    >
      <div class="mb-1.5 text-[11px] text-readion-accent-label uppercase tracking-wider">Suggested focus next session</div>
      <div class="font-medium text-[13px] text-readion-text-primary">{{ summary.nextFocus.domain }}</div>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        data-testid="drill-button"
        class="flex flex-1 items-center justify-center gap-2 rounded-md bg-readion-primary px-4 py-2.5 font-semibold text-sm text-white"
        @click="emit('drill')"
      >
        Drill my misses →
      </button>
      <button
        type="button"
        data-testid="summary-back-button"
        class="rounded-md border border-readion-border-strong px-5 py-2.5 text-readion-text-secondary text-sm"
        @click="emit('back')"
      >
        Back to dashboard
      </button>
    </div>

    <div
      v-if="drillNoMisses"
      data-testid="drill-empty"
      class="rounded-md border border-readion-border-default bg-readion-background-surface px-4 py-3 text-readion-text-muted text-[13px]"
    >
      No misses to drill — every question this session was answered correctly.
    </div>
  </div>
</template>
