<script setup lang="ts">
import type { MockExamDomainBreakdown } from '@readion/shared'
import { computed } from 'vue'
import { weightPercent } from '~/composables/mockExamResults'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'

const props = defineProps<{
  breakdown: MockExamDomainBreakdown
  passingScore?: number | null
  domains?: { name: string; weight: number }[] | null
}>()

interface DomainRow {
  domain: string
  percent: number
  colorClass: string
  correct: number
  total: number
  weightPercent: number | null
  belowThreshold: boolean
}

const domainWeights = computed<Map<string, number>>(
  () => new Map((props.domains ?? []).map((domain) => [domain.name, weightPercent(domain.weight)])),
)

const rows = computed<DomainRow[]>(() =>
  Object.entries(props.breakdown).map(([domain, stat]) => {
    const percent = Math.round(stat.accuracy * 100)
    return {
      domain,
      percent,
      colorClass: statusTextColorClass(statusColorForScore(percent)),
      correct: stat.correct,
      total: stat.total,
      weightPercent: domainWeights.value.get(domain) ?? null,
      belowThreshold: props.passingScore != null && percent < props.passingScore,
    }
  }),
)
</script>

<template>
  <div
    data-testid="exam-domain-breakdown"
    class="overflow-hidden rounded-xl border border-readion-border-strong bg-readion-background-surface"
  >
    <div
      v-for="row in rows"
      :key="row.domain"
      data-testid="exam-domain-row"
      class="flex items-center gap-3 border-readion-border-default border-b px-5 py-4 last:border-b-0"
    >
      <div class="min-w-0 flex-1 text-[13px] text-readion-text-secondary">
        <div class="flex items-center gap-1.5">
          <span class="truncate">{{ row.domain }}</span>
          <span
            v-if="row.belowThreshold"
            data-testid="exam-domain-threshold-marker"
            class="text-readion-status-poor"
          >
            ⚠
          </span>
        </div>
        <div
          v-if="row.belowThreshold"
          data-testid="exam-below-threshold-note"
          class="text-[11px] text-readion-status-poor"
        >
          Below passing threshold
        </div>
      </div>
      <div
        v-if="row.weightPercent !== null"
        data-testid="exam-domain-weight"
        class="flex-shrink-0 text-[11px] text-readion-text-subtle"
      >
        {{ row.weightPercent }}%
      </div>
      <div class="flex-shrink-0 text-[11px] text-readion-text-subtle">{{ row.correct }}/{{ row.total }}</div>
      <div class="w-10 flex-shrink-0 text-right font-semibold text-[13px]" :class="row.colorClass">
        {{ row.percent }}%
      </div>
    </div>
  </div>
</template>
