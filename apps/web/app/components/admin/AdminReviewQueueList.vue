<script setup lang="ts">
import type { QuarantinedItemListItem } from '@readion/shared'
import { formatRelativeAdminTimestamp } from '~/utils/relativeAdminTimestamp'
import { formatVerdict, verdictInputFromProvenance } from '~/utils/formatVerdict'

interface CertLookupEntry {
  name: string
  code: string
}

interface CertChip {
  id: string
  label: string
}

const props = withDefaults(
  defineProps<{
    items: QuarantinedItemListItem[]
    selectedId: string | null
    certsById?: Record<string, CertLookupEntry>
    certChips?: CertChip[]
    selectedCertId?: string | null
  }>(),
  { certsById: () => ({}), certChips: () => [], selectedCertId: null },
)

const emit = defineEmits<{ select: [id: string]; selectCertFilter: [id: string | null] }>()

function formatDate(createdAt: string): string {
  return formatRelativeAdminTimestamp(createdAt)
}

function certLabel(certificationId: string): string | undefined {
  const cert = props.certsById[certificationId]
  return cert?.code ?? cert?.name
}

function verdictFor(item: QuarantinedItemListItem) {
  return formatVerdict(verdictInputFromProvenance(item))
}
</script>

<template>
  <div class="flex w-80 flex-shrink-0 flex-col overflow-y-auto border-readion-border-strong border-r">
    <div
      class="flex flex-shrink-0 items-center justify-between gap-2 border-readion-border-strong border-b px-4 py-2.5"
    >
      <span data-testid="review-queue-panel-label" class="font-medium text-slate-200 text-xs">
        Quarantined items
      </span>
      <div v-if="certChips.length > 0" class="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="review-queue-cert-chip"
          data-cert-id="all"
          :aria-pressed="selectedCertId === null"
          class="rounded-full px-2.5 py-0.5 text-[11px] transition-colors"
          :class="
            selectedCertId === null
              ? 'bg-readion-primary text-white'
              : 'border border-readion-border-strong text-slate-400 hover:border-readion-primary'
          "
          @click="emit('selectCertFilter', null)"
        >
          All
        </button>
        <button
          v-for="chip in certChips"
          :key="chip.id"
          type="button"
          data-testid="review-queue-cert-chip"
          :data-cert-id="chip.id"
          :aria-pressed="selectedCertId === chip.id"
          class="rounded-full px-2.5 py-0.5 text-[11px] transition-colors"
          :class="
            selectedCertId === chip.id
              ? 'bg-readion-primary text-white'
              : 'border border-readion-border-strong text-slate-400 hover:border-readion-primary'
          "
          @click="emit('selectCertFilter', chip.id)"
        >
          {{ chip.label }}
        </button>
      </div>
    </div>

    <ul class="flex flex-1 flex-col divide-y divide-readion-background-surface/60 overflow-y-auto">
      <li
        v-for="item in items"
        :key="item.id"
        data-testid="review-queue-item"
        :data-item-id="item.id"
        :data-selected="item.id === selectedId"
        class="cursor-pointer border-l-2 px-4 py-3 transition-colors"
        :class="
          item.id === selectedId
            ? 'border-l-readion-primary bg-readion-primary/10'
            : 'border-l-transparent hover:bg-readion-background-surface/40'
        "
        @click="emit('select', item.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span
              data-testid="review-queue-item-id"
              class="truncate font-mono text-[11px] text-slate-500"
            >
              {{ item.id }}
            </span>
            <span
              v-if="certLabel(item.certificationId)"
              data-testid="review-queue-item-cert"
              class="flex-shrink-0 rounded-sm bg-readion-background-elevated px-1.5 py-0.5 text-[10px] text-slate-400"
            >
              {{ certLabel(item.certificationId) }}
            </span>
          </div>
          <span data-testid="review-queue-item-date" class="flex-shrink-0 text-slate-500 text-xs">
            {{ formatDate(item.createdAt) }}
          </span>
        </div>
        <!-- Design calls for a question-text snippet here, but QuarantinedItemListItem (the list
             DTO) carries no question/content field — quarantine-admin.service.ts's
             LIST_ITEM_FIELDS excludes generatedContent. `reason` is the closest existing
             free-text field; a literal question snippet needs a backend field addition. -->
        <p
          data-testid="review-queue-item-snippet"
          class="mt-1.5 line-clamp-2 text-slate-300 text-xs leading-relaxed"
        >
          {{ item.reason }}
        </p>
        <p
          data-testid="review-queue-item-verdict"
          class="mt-1.5 font-medium text-xs"
          :class="
            verdictFor(item).tone === 'good'
              ? 'text-readion-status-good'
              : 'text-readion-status-poor'
          "
        >
          {{ verdictFor(item).label }} · {{ verdictFor(item).scorePercent }}
        </p>
      </li>
    </ul>
  </div>
</template>
