<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  limit: number
  total: number
  testid: string
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))

function goToPrevious() {
  if (props.page > 1) {
    emit('update:page', props.page - 1)
  }
}

function goToNext() {
  if (props.page < totalPages.value) {
    emit('update:page', props.page + 1)
  }
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    :data-testid="testid"
    class="flex items-center justify-end gap-3 text-slate-300 text-sm"
  >
    <button
      type="button"
      :data-testid="`${testid}-prev`"
      class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-xs transition-colors hover:bg-readion-background-surface disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="page <= 1"
      @click="goToPrevious"
    >
      Previous
    </button>
    <span :data-testid="`${testid}-info`">Page {{ page }} of {{ totalPages }}</span>
    <button
      type="button"
      :data-testid="`${testid}-next`"
      class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-xs transition-colors hover:bg-readion-background-surface disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="page >= totalPages"
      @click="goToNext"
    >
      Next
    </button>
  </nav>
</template>
