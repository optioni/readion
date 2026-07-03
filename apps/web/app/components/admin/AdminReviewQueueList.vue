<script setup lang="ts">
import type { QuarantinedItemListItem } from '@readion/shared'

defineProps<{
  items: QuarantinedItemListItem[]
  selectedId: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(createdAt: string): string {
  return dateFormatter.format(new Date(createdAt))
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
        <span class="font-medium text-slate-100 text-sm">{{ item.domain }}</span>
        <span class="text-slate-500 text-xs">{{ formatDate(item.createdAt) }}</span>
      </div>
      <p class="mt-1 line-clamp-2 text-slate-400 text-xs">{{ item.reason }}</p>
    </li>
  </ul>
</template>
