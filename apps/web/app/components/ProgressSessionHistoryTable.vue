<script setup lang="ts">
import DeltaBadge from '~/components/DeltaBadge.vue'
import { friendlyDate } from '~/composables/friendlyDate'
import { friendlyTime } from '~/composables/friendlyTime'
import { mockExamRunPath, sessionRunPath } from '~/composables/runnerRoutes'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'
import type { MergedHistoryRow } from '~/composables/useSessionHistoryMerge'

const HISTORY_COLUMNS = ['Date', 'Type', 'Duration', 'Questions', 'Accuracy', 'Readiness'] as const

defineProps<{
  rows: MergedHistoryRow[]
}>()

function rowPath(row: MergedHistoryRow): string {
  if (row.kind === 'mock' || row.kind === 'diagnostic') {
    return mockExamRunPath(row.id)
  }
  return sessionRunPath(row.id)
}

function accuracyColorClass(accuracy: number): string {
  return statusTextColorClass(statusColorForScore(accuracy))
}
</script>

<template>
  <div class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Session History</div>

    <p v-if="rows.length === 0" class="py-4 text-center text-slate-500 text-xs">
      No sessions yet
    </p>

    <template v-else>
      <div
        data-testid="progress-history-header"
        class="flex items-center gap-3 border-readion-background-surface border-b pb-2 text-[11px] text-slate-500 uppercase tracking-wide"
      >
        <span v-for="column in HISTORY_COLUMNS" :key="column" class="flex-1 first:flex-[1.6]">
          {{ column }}
        </span>
      </div>

      <div class="divide-y divide-readion-background-surface">
        <div
          v-for="row in rows"
          :key="row.id"
          data-testid="progress-session-row"
          class="flex items-center gap-3 py-2 text-sm"
        >
          <a
            :href="rowPath(row)"
            class="flex flex-1 items-center gap-3 text-slate-200 hover:text-slate-100"
          >
            <span class="flex-[1.6]">
              <span class="block text-slate-400 text-xs">{{ friendlyDate(row.startedAt) }}</span>
              <span data-testid="session-time-of-day" class="block text-[10px] text-slate-500">
                {{ friendlyTime(row.startedAt) }}
              </span>
            </span>

            <span
              class="inline-flex items-center rounded px-1.5 py-0.5 font-medium text-[11px] uppercase tracking-wide"
              :class="{
                'bg-readion-primary/20 text-readion-primary': row.kind === 'study',
                'bg-purple-500/20 text-purple-400':
                  row.kind === 'mock' || row.kind === 'diagnostic',
                'bg-amber-500/20 text-amber-400': row.kind === 'drill' || row.kind === 'review',
              }"
            >
              {{ row.kind }}
            </span>

            <span data-testid="session-duration" class="text-slate-400 text-xs">
              {{ row.durationMinutes !== null ? `${row.durationMinutes}m` : '—' }}
            </span>

            <span data-testid="session-questions" class="text-slate-400 text-xs">
              {{ row.questionsAnswered !== null ? row.questionsAnswered : '—' }}
            </span>

            <span
              class="text-xs"
              :class="row.accuracy !== null ? accuracyColorClass(row.accuracy) : 'text-slate-500'"
            >
              {{ row.accuracy !== null ? `${row.accuracy}%` : '—' }}
            </span>

            <span data-testid="session-readiness-delta" class="text-xs">
              <DeltaBadge v-if="row.readinessDelta !== null" :value="row.readinessDelta" />
              <span v-else class="text-slate-500">—</span>
            </span>
          </a>
        </div>
      </div>
    </template>
  </div>
</template>
