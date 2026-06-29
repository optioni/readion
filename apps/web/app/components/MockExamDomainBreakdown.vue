<script setup lang="ts">
import type { MockExamDomainBreakdown } from '@readion/shared'
import { computed } from 'vue'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'

const props = defineProps<{ breakdown: MockExamDomainBreakdown }>()

interface DomainRow {
  domain: string
  percent: number
  colorClass: string
  correct: number
  total: number
}

const rows = computed<DomainRow[]>(() =>
  Object.entries(props.breakdown).map(([domain, stat]) => {
    const percent = Math.round(stat.accuracy * 100)
    return {
      domain,
      percent,
      colorClass: statusTextColorClass(statusColorForScore(percent)),
      correct: stat.correct,
      total: stat.total,
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
      <div class="min-w-0 flex-1 truncate text-[13px] text-readion-text-secondary">{{ row.domain }}</div>
      <div class="flex-shrink-0 text-[11px] text-readion-text-subtle">{{ row.correct }}/{{ row.total }}</div>
      <div class="w-10 flex-shrink-0 text-right font-semibold text-[13px]" :class="row.colorClass">
        {{ row.percent }}%
      </div>
    </div>
  </div>
</template>
