<script setup lang="ts">
import type { QuarantinedItemListItem } from '@readion/shared'
import { formatVerdict, verdictInputFromProvenance } from '~/utils/formatVerdict'

interface CertLookupEntry {
  name: string
  code: string
}

const props = withDefaults(
  defineProps<{
    items: QuarantinedItemListItem[]
    selectedId: string | null
    certsById?: Record<string, CertLookupEntry>
  }>(),
  { certsById: () => ({}) },
)

const emit = defineEmits<{ select: [id: string] }>()

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(createdAt: string): string {
  return dateFormatter.format(new Date(createdAt))
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
  <ul class="flex w-80 flex-shrink-0 flex-col divide-y divide-readion-background-surface/60 overflow-y-auto border-readion-background-surface border-r">
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
        <span
          data-testid="review-queue-item-id"
          class="truncate font-mono text-[11px] text-slate-500"
        >
          {{ item.id }}
        </span>
        <span class="flex-shrink-0 text-slate-500 text-xs">{{ formatDate(item.createdAt) }}</span>
      </div>
      <div class="mt-1 flex items-center justify-between gap-2">
        <span class="font-medium text-slate-100 text-sm">{{ item.domain }}</span>
        <span
          v-if="certLabel(item.certificationId)"
          data-testid="review-queue-item-cert"
          class="flex-shrink-0 rounded-full bg-readion-background-surface px-2 py-0.5 text-[10px] text-slate-300"
        >
          {{ certLabel(item.certificationId) }}
        </span>
      </div>
      <p class="mt-1 line-clamp-2 text-slate-400 text-xs">{{ item.reason }}</p>
      <p
        data-testid="review-queue-item-verdict"
        class="mt-1 font-medium text-xs"
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
</template>
