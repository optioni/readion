<script setup lang="ts">
import type { ReviewItemResponse } from '@readion/shared'
import { computed } from 'vue'
import { useDueDomainBreakdown } from '~/composables/useDueDomainBreakdown'
import { sessionStartPath } from '~/composables/runnerRoutes'

const props = defineProps<{
  enrollmentId: string
  items: ReviewItemResponse[]
  dueCount: number
}>()

const emit = defineEmits<{ start: [] }>()

const domainBreakdown = computed(() => useDueDomainBreakdown(props.items))
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
    class="flex flex-col gap-5 rounded-xl border border-readion-border-strong bg-readion-background-surface px-8 py-8"
  >
    <div class="flex items-center gap-4">
      <div
        class="flex h-14 w-14 items-center justify-center rounded-full bg-readion-primary/10 font-bold text-2xl text-readion-primary"
        data-testid="review-due-count"
      >
        {{ dueCount }}
      </div>
      <div>
        <p class="font-semibold text-readion-text-primary">
          {{ dueCount }} item{{ dueCount === 1 ? '' : 's' }} due for review
        </p>
        <p class="text-readion-text-muted text-sm">~5 minutes</p>
      </div>
    </div>

    <div
      data-testid="review-domain-breakdown"
      class="flex flex-col gap-1.5"
    >
      <p class="mb-1 text-[11px] text-readion-text-muted uppercase tracking-wider">By domain</p>
      <div
        v-for="entry in domainBreakdown"
        :key="entry.domain"
        class="flex items-center justify-between text-sm"
      >
        <span class="text-readion-text-secondary">{{ entry.domain }}</span>
        <span class="font-medium text-readion-text-primary">{{ entry.count }}</span>
      </div>
    </div>

    <button
      type="button"
      data-testid="start-review-button"
      class="w-full rounded-md bg-readion-primary px-5 py-2.5 font-semibold text-sm text-white"
      @click="emit('start')"
    >
      Start review →
    </button>
  </div>
</template>
