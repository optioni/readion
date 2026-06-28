<script setup lang="ts">
import { computed, ref } from 'vue'
import CardPanel from '~/components/CardPanel.vue'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { filterSessionsByType, type SessionTypeFilter } from '~/composables/sessionTypeFilter'
import { useSessionsHistory } from '~/composables/useSessionsHistory'

const props = defineProps<{ certificationId: string | null }>()

const pageInput = ref(1)
const limitInput = ref(10)

const { rows, total, page, limit, isLoading } = useSessionsHistory(
  computed(() => props.certificationId),
  { page: pageInput, limit: limitInput },
)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const showPager = computed(() => totalPages.value > 1)

function prevPage() {
  if (page.value > 1) {
    page.value -= 1
  }
}
function nextPage() {
  if (page.value < totalPages.value) {
    page.value += 1
  }
}

const activeFilter = ref<SessionTypeFilter>('all')
function selectFilter(filter: SessionTypeFilter) {
  activeFilter.value = filter
}

const filters: { id: SessionTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'study', label: 'Study' },
  { id: 'review', label: 'Review' },
]

const visibleRows = computed(() => filterSessionsByType(rows.value, activeFilter.value))

const hasSessions = computed(() => rows.value.length > 0)

const statusClass = (status: string) => {
  if (status === 'completed') {
    return 'text-readion-status-good'
  }
  if (status === 'abandoned') {
    return 'text-readion-status-poor'
  }
  return 'text-slate-400'
}

const formatAccuracy = (accuracy: number | null) =>
  accuracy === null ? null : `${Math.round(accuracy * 100)}%`
</script>

<template>
  <div class="space-y-4">
    <div role="group" aria-label="Filter sessions by type" class="flex gap-2">
      <button
        v-for="filter in filters"
        :key="filter.id"
        type="button"
        :data-testid="`session-filter-${filter.id}`"
        :aria-pressed="activeFilter === filter.id"
        class="rounded-md px-3 py-1 text-xs transition-colors"
        :class="
          activeFilter === filter.id
            ? 'bg-readion-primary text-white'
            : 'bg-black/25 text-slate-400 hover:text-slate-200'
        "
        @click="selectFilter(filter.id)"
      >
        {{ filter.label }}
      </button>
    </div>

    <div
      v-if="!hasSessions && !isLoading"
      data-testid="sessions-empty"
      class="rounded-md bg-black/25 px-4 py-10 text-center text-slate-400 text-sm"
    >
      No sessions yet
    </div>

    <CardPanel v-else data-testid="sessions-history-table" label="Session History">
      <NuxtLink
        v-for="row in visibleRows"
        :key="row.id"
        data-testid="session-row"
        :to="sessionRunPath(row.id)"
        class="mb-1 flex items-center justify-between gap-3 border-readion-background-surface border-b py-2 text-xs last:border-b-0"
      >
        <span class="text-slate-400">{{ row.date.slice(0, 10) }}</span>
        <span class="rounded bg-black/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
          {{ row.kind }}
        </span>
        <span class="flex-1 text-slate-200">{{ row.focusArea }}</span>
        <span class="text-slate-400">{{ row.durationMinutes }}m</span>
        <span class="uppercase" :class="statusClass(row.status)">{{ row.status }}</span>
        <span v-if="formatAccuracy(row.accuracy) !== null" class="text-slate-100">
          {{ formatAccuracy(row.accuracy) }}
        </span>
      </NuxtLink>
    </CardPanel>

    <nav
      v-if="showPager"
      data-testid="sessions-pagination"
      aria-label="Sessions pages"
      class="flex items-center justify-between gap-3 text-xs"
    >
      <button
        type="button"
        data-testid="sessions-page-prev"
        :disabled="page <= 1"
        class="rounded-md bg-black/25 px-3 py-1 text-slate-300 transition-colors hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-600"
        @click="prevPage"
      >
        Previous
      </button>
      <span class="text-slate-400">Page {{ page }} of {{ totalPages }}</span>
      <button
        type="button"
        data-testid="sessions-page-next"
        :disabled="page >= totalPages"
        class="rounded-md bg-black/25 px-3 py-1 text-slate-300 transition-colors hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-600"
        @click="nextPage"
      >
        Next
      </button>
    </nav>
  </div>
</template>
