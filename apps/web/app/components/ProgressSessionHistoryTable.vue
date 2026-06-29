<script setup lang="ts">
import { mockExamRunPath, sessionRunPath } from '~/composables/runnerRoutes'
import type { MergedHistoryRow } from '~/composables/useSessionHistoryMerge'

defineProps<{
  rows: MergedHistoryRow[]
}>()

function rowPath(row: MergedHistoryRow): string {
  if (row.kind === 'mock' || row.kind === 'diagnostic') {
    return mockExamRunPath(row.id)
  }
  return sessionRunPath(row.id)
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return new Date(iso).toLocaleDateString()
}
</script>

<template>
  <div class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Session History</div>

    <p v-if="rows.length === 0" class="py-4 text-center text-slate-500 text-xs">
      No sessions yet
    </p>

    <div v-else class="divide-y divide-readion-background-surface">
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
          <span
            class="inline-flex items-center rounded px-1.5 py-0.5 font-medium text-[11px] uppercase tracking-wide"
            :class="{
              'bg-readion-primary/20 text-readion-primary': row.kind === 'study',
              'bg-purple-500/20 text-purple-400': row.kind === 'mock' || row.kind === 'diagnostic',
              'bg-amber-500/20 text-amber-400': row.kind === 'drill' || row.kind === 'review',
            }"
          >
            {{ row.kind }}
          </span>

          <span class="flex-1 text-slate-400 text-xs">{{ formatDate(row.startedAt) }}</span>

          <span
            class="text-xs"
            :class="
              row.accuracy !== null
                ? row.accuracy >= 70
                  ? 'text-readion-status-good'
                  : row.accuracy >= 50
                    ? 'text-readion-status-warning'
                    : 'text-readion-status-poor'
                : 'text-slate-500'
            "
          >
            {{ row.accuracy !== null ? `${row.accuracy}%` : '—' }}
          </span>
        </a>
      </div>
    </div>
  </div>
</template>
