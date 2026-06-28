<script setup lang="ts">
import { computed } from 'vue'
import CardPanel from '~/components/CardPanel.vue'
import { mockExamRunPath } from '~/composables/runnerRoutes'
import { useExamHistory } from '~/composables/useExamHistory'

const props = defineProps<{ enrollmentId: string }>()

const { rows, isLoading } = useExamHistory(props.enrollmentId)

const hasAttempts = computed(() => rows.value.length > 0)

const rowClass =
  'mb-1 flex items-center justify-between gap-3 border-readion-background-surface border-b py-2 text-xs last:border-b-0'
const pillClass = 'rounded bg-black/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider'

const isSubmitted = (status: string) => status === 'submitted'

const statusClass = (status: string) => {
  if (status === 'submitted') {
    return 'text-readion-status-good'
  }
  if (status === 'expired') {
    return 'text-readion-status-poor'
  }
  return 'text-slate-400'
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="!hasAttempts && !isLoading"
      data-testid="exam-history-empty"
      class="rounded-md bg-black/25 px-4 py-10 text-center text-slate-400 text-sm"
    >
      No exam attempts yet
    </div>

    <CardPanel v-else data-testid="exam-history-list" label="Exam History">
      <template v-for="row in rows" :key="row.id">
        <NuxtLink
          v-if="isSubmitted(row.status)"
          data-testid="exam-history-row"
          :to="mockExamRunPath(row.id)"
          :class="rowClass"
        >
          <span class="text-slate-400">{{ row.date?.slice(0, 10) }}</span>
          <span :class="pillClass">{{ row.type }}</span>
          <span class="flex-1 uppercase" :class="statusClass(row.status)">{{ row.status }}</span>
          <span v-if="row.score !== null" class="text-slate-100">{{ Math.round(row.score) }}</span>
          <span
            v-if="row.passed !== null"
            :class="row.passed ? 'text-readion-status-good' : 'text-readion-status-poor'"
          >
            {{ row.passed ? 'Pass' : 'Fail' }}
          </span>
        </NuxtLink>
        <div v-else data-testid="exam-history-row" :class="rowClass">
          <span class="text-slate-400">{{ row.date?.slice(0, 10) }}</span>
          <span :class="pillClass">{{ row.type }}</span>
          <span class="flex-1 uppercase" :class="statusClass(row.status)">{{ row.status }}</span>
          <span v-if="row.score !== null" class="text-slate-100">{{ Math.round(row.score) }}</span>
          <span
            v-if="row.passed !== null"
            :class="row.passed ? 'text-readion-status-good' : 'text-readion-status-poor'"
          >
            {{ row.passed ? 'Pass' : 'Fail' }}
          </span>
        </div>
      </template>
    </CardPanel>
  </div>
</template>
