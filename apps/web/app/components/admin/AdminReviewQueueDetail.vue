<script setup lang="ts">
import type { QuarantinedItemDetail, VerifierVerdict } from '@readion/shared'
import { computed } from 'vue'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'
import { formatVerdict } from '~/utils/formatVerdict'

const props = defineProps<{
  id: string | null
  pendingId?: string | null
}>()

const emit = defineEmits<{ approve: [id: string]; reject: [id: string] }>()

const idRef = computed(() => props.id)
const detailQuery = useAdminQuarantineDetail(idRef)

const isLoading = computed(() => detailQuery.isLoading.value)
const detail = computed<QuarantinedItemDetail | undefined>(() => detailQuery.data.value)

function provenanceChunks(sourceChunkIds: string[]): string {
  return sourceChunkIds.join(', ')
}

const verdict = computed(() => {
  const current = detail.value
  if (!current) return null

  const nestedVerdict = current.provenance.verdict as VerifierVerdict | undefined
  return formatVerdict({
    pass: nestedVerdict?.pass ?? false,
    score: nestedVerdict?.score ?? current.provenance.score,
    reason: current.reason,
  })
})

const toneClasses = computed(() =>
  verdict.value?.tone === 'good'
    ? 'border-readion-status-good/30 bg-readion-status-good/10 text-readion-status-good'
    : 'border-readion-status-poor/30 bg-readion-status-poor/10 text-readion-status-poor',
)

function isPending(id: string): boolean {
  return props.pendingId === id
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

    <div
      v-else-if="isLoading"
      data-testid="review-queue-detail-loading"
      class="flex h-full items-center justify-center text-center text-slate-400 text-sm"
    >
      Loading item detail…
    </div>

    <div v-else-if="detail && verdict" data-testid="review-queue-detail" class="flex flex-col gap-5">
      <div class="rounded-lg border px-4 py-4" :class="toneClasses">
        <p data-testid="review-queue-verdict" class="font-semibold text-sm">
          {{ verdict.label }} · {{ verdict.scorePercent }} · {{ verdict.reason }}
        </p>
        <p data-testid="review-queue-reason" class="mt-1 text-slate-300 text-xs">
          {{ detail.reason }}
        </p>
        <p data-testid="review-queue-provenance" class="mt-1 text-slate-500 text-xs">
          Source chunks: {{ provenanceChunks(detail.provenance.sourceChunkIds) }}
        </p>
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

      <div class="flex gap-2">
        <button
          type="button"
          data-testid="approve-item-btn"
          :disabled="isPending(detail.id)"
          class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface disabled:opacity-50"
          @click="emit('approve', detail.id)"
        >
          Approve
        </button>
        <button
          type="button"
          data-testid="reject-item-btn"
          :disabled="isPending(detail.id)"
          class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface disabled:opacity-50"
          @click="emit('reject', detail.id)"
        >
          Reject
        </button>
      </div>
    </div>
  </div>
</template>
