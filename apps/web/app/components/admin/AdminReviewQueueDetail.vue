<script setup lang="ts">
import type { QuarantinedItemDetail } from '@readion/shared'
import { computed } from 'vue'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'
import { formatVerdict, verdictInputFromProvenance } from '~/utils/formatVerdict'

const props = defineProps<{
  id: string | null
  pendingId?: string | null
  pendingAction?: 'approve' | 'reject' | null
  actionError?: string | null
}>()

const emit = defineEmits<{ approve: [id: string]; reject: [id: string] }>()

const idRef = computed(() => props.id)
const detailQuery = useAdminQuarantineDetail(idRef)

const detail = computed<QuarantinedItemDetail | undefined>(() => detailQuery.data.value)
const isLoading = computed(() => detailQuery.isLoading.value && !detail.value)
const isError = computed(() => detailQuery.isError.value && !detail.value)

function firstSpan(supportingSpans: string[]): string | null {
  return supportingSpans[0] ?? null
}

function firstChunk(sourceChunkIds: string[]): string | null {
  return sourceChunkIds[0] ?? null
}

const verdict = computed(() => {
  const current = detail.value
  if (!current) return null

  return formatVerdict(verdictInputFromProvenance(current))
})

const toneClasses = computed(() =>
  verdict.value?.tone === 'good'
    ? 'border-readion-status-good/30 bg-readion-status-good/10 text-readion-status-good'
    : 'border-readion-status-poor/30 bg-readion-status-poor/10 text-readion-status-poor',
)

function isPending(id: string): boolean {
  return props.pendingId === id
}

function isActionPending(id: string, action: 'approve' | 'reject'): boolean {
  return isPending(id) && props.pendingAction === action
}
</script>

<template>
  <div class="flex-1 overflow-y-auto px-6 py-5">
    <div
      v-if="!id"
      data-testid="review-queue-detail-empty"
      class="flex h-full items-center justify-center text-center text-slate-400 text-sm"
    >
      Select an item to review.
    </div>

    <AdminAsyncMessage
      v-else-if="isLoading"
      kind="loading"
      message="Loading item detail…"
      data-testid="review-queue-detail-loading"
    />

    <AdminAsyncMessage
      v-else-if="isError"
      kind="error"
      message="Could not load this item's detail. Please try again."
      :retrying="detailQuery.isFetching?.value ?? false"
      data-testid="review-queue-detail-error"
      @retry="detailQuery.refetch()"
    />

    <div v-else-if="detail && verdict" data-testid="review-queue-detail" class="flex flex-col gap-5">
      <div class="rounded-lg border px-4 py-4" :class="toneClasses">
        <div class="flex items-center gap-2">
          <svg
            v-if="verdict.tone === 'poor'"
            data-testid="review-queue-decision-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0"
            aria-hidden="true"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p data-testid="review-queue-verdict" class="font-semibold text-sm">
            {{ verdict.label }} · {{ verdict.scorePercent }} · {{ verdict.reason }}
          </p>
        </div>
        <p data-testid="review-queue-reason" class="mt-1 text-slate-300 text-xs">
          {{ detail.reason }}
        </p>
      </div>

      <div
        data-testid="review-queue-evidence-card"
        class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-4 py-4"
      >
        <div class="mb-2 font-medium text-[10px] text-slate-500 uppercase tracking-wide">
          Source evidence
        </div>
        <blockquote
          v-if="firstSpan(detail.provenance.supportingSpans)"
          class="border-readion-accent-label border-l-2 pl-3 text-slate-300 text-sm leading-relaxed"
        >
          "<mark
            data-testid="review-queue-evidence-highlight"
            class="rounded bg-readion-accent-label/25 px-0.5 text-slate-100"
            >{{ firstSpan(detail.provenance.supportingSpans) }}</mark
          >"
        </blockquote>
        <p v-else class="text-slate-500 text-xs">No supporting evidence was captured.</p>
        <div
          v-if="firstChunk(detail.provenance.sourceChunkIds)"
          data-testid="review-queue-evidence-source"
          class="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-readion-accent-label"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
            class="shrink-0"
            aria-hidden="true"
          >
            <path d="M6 1h4a1 1 0 011 1v9a1 1 0 01-1 1H2a1 1 0 01-1-1V5l4-4z" />
            <path d="M6 1v4h4" />
          </svg>
          {{ firstChunk(detail.provenance.sourceChunkIds) }}
        </div>
      </div>

      <div
        v-if="!detail.content"
        data-testid="review-queue-detail-no-content"
        class="rounded-lg border border-readion-background-surface border-dashed bg-readion-background-surface/40 px-5 py-6 text-center text-slate-400 text-sm"
      >
        This item has no structured question content to display.
      </div>

      <div v-else class="flex flex-col gap-3 rounded-lg border border-readion-background-surface bg-readion-background-surface/40 px-5 py-4">
        <p data-testid="review-queue-question" class="text-slate-100 text-sm">
          {{ detail.content.question }}
        </p>
        <ul class="flex flex-col gap-2">
          <li
            v-for="option in detail.content.options"
            :key="option"
            data-testid="review-queue-option"
            :data-answer-key="option === detail.content.answerKey"
            class="rounded-md border px-3 py-2 text-sm"
            :class="
              option === detail.content.answerKey
                ? 'border-readion-status-good/30 bg-readion-status-good/10 text-readion-status-good'
                : 'border-readion-background-surface text-slate-300'
            "
          >
            {{ option }}
            <span v-if="option === detail.content.answerKey" class="ml-2 text-xs">Marked correct</span>
          </li>
        </ul>
        <p class="text-slate-500 text-xs">
          Stored answer key: <span data-testid="review-queue-answer-key">{{ detail.content.answerKey }}</span>
        </p>
      </div>

      <p
        v-if="actionError"
        data-testid="review-queue-action-error"
        class="text-readion-status-poor text-sm"
        role="alert"
      >
        <span data-testid="review-queue-error-banner">{{ actionError }}</span>
      </p>

      <div class="flex gap-2">
        <ReadionButton
          data-testid="approve-item-btn"
          :disabled="isPending(detail.id)"
          :busy="isActionPending(detail.id, 'approve')"
          busy-label="Approving…"
          class="!min-h-0 px-3 py-1.5 text-xs"
          @click="emit('approve', detail.id)"
        >
          Approve
        </ReadionButton>
        <ReadionButton
          data-testid="reject-item-btn"
          variant="secondary"
          :disabled="isPending(detail.id)"
          :busy="isActionPending(detail.id, 'reject')"
          busy-label="Rejecting…"
          class="!min-h-0 px-3 py-1.5 text-xs"
          @click="emit('reject', detail.id)"
        >
          Reject
        </ReadionButton>
      </div>
    </div>
  </div>
</template>
