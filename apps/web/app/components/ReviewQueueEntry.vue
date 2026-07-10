<script setup lang="ts">
import type { ReviewItemResponse } from '@readion/shared'
import { computed } from 'vue'
import { sessionStartPath } from '~/composables/runnerRoutes'
import { useDueDomainBreakdown } from '~/composables/useDueDomainBreakdown'
import { formatOverdueSummary, useOverdueSummary } from '~/composables/useOverdueSummary'

const props = defineProps<{
  enrollmentId: string
  items: ReviewItemResponse[]
  dueCount: number
}>()

const emit = defineEmits<{
  start: []
}>()

const domainBreakdown = computed(() => useDueDomainBreakdown(props.items))

const overdueNote = computed(() => {
  const summary = useOverdueSummary(props.items, new Date())
  return summary ? formatOverdueSummary(summary) : null
})
</script>

<template>
  <div
    v-if="dueCount === 0"
    data-testid="review-all-caught-up"
    class="flex flex-col items-center gap-5 rounded-xl border border-readion-border-strong bg-readion-background-surface px-8 py-10 text-center"
  >
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-readion-status-good/10 text-2xl text-readion-status-good">
      ✓
    </div>
    <div>
      <p class="mb-1 font-semibold text-readion-text-primary">All caught up!</p>
      <p class="text-readion-text-muted text-sm">No items are due for review right now.</p>
    </div>
    <a
      data-testid="review-study-instead-link"
      :href="sessionStartPath(enrollmentId)"
      class="rounded-md border border-readion-border-strong px-4 py-2 text-readion-text-secondary text-sm hover:border-readion-primary hover:text-readion-primary"
    >
      Start a study session instead
    </a>
  </div>

  <div
    v-else
    data-testid="review-queue-entry"
    class="flex flex-1 flex-col items-center justify-center gap-7 px-8 py-10 text-center"
  >
    <div
      data-testid="review-queue-icon"
      class="flex h-13 w-13 items-center justify-center rounded-xl border border-readion-accent-label/20 bg-readion-accent-label/10 text-readion-accent-label"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    </div>

    <div>
      <div data-testid="review-due-count" class="mb-2 font-bold text-2xl text-readion-text-primary leading-none">
        {{ dueCount }}
      </div>
      <p class="mb-1.5 font-semibold text-readion-text-primary text-base">
        item{{ dueCount === 1 ? '' : 's' }} due for review
      </p>
      <p class="text-readion-text-muted text-sm">Scheduled by spaced repetition &middot; ~5 minutes</p>
    </div>

    <div
      data-testid="review-domain-breakdown"
      class="flex flex-wrap justify-center gap-2"
    >
      <span
        v-for="entry in domainBreakdown"
        :key="entry.domain"
        data-testid="review-domain-chip"
        class="inline-flex items-center gap-1.5 rounded-full border border-readion-border-strong bg-readion-background-surface px-3 py-1"
      >
        <span class="text-readion-text-secondary text-xs">{{ entry.domain }}</span>
        <span class="font-semibold text-readion-primary text-xs">{{ entry.count }}</span>
      </span>
    </div>

    <div class="flex w-full max-w-[380px] items-center gap-3">
      <button
        type="button"
        data-testid="start-review-button"
        class="flex-1 rounded-md bg-readion-primary px-5 py-2.5 font-semibold text-sm text-white"
        @click="emit('start')"
      >
        Start review →
      </button>
      <button
        type="button"
        data-testid="review-all-button"
        class="whitespace-nowrap rounded-md border border-readion-border-strong px-4 py-2.5 text-readion-text-secondary text-xs"
        @click="emit('start')"
      >
        Review all {{ dueCount }}
      </button>
    </div>

    <p
      v-if="overdueNote"
      data-testid="review-overdue-note"
      class="text-readion-text-subtle text-xs"
    >
      Oldest due: <span class="font-medium text-readion-status-warning">{{ overdueNote }}</span>
    </p>
  </div>
</template>
