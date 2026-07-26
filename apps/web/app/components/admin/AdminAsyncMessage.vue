<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'

const props = withDefaults(
  defineProps<{
    kind: 'loading' | 'error'
    message: string
    retrying?: boolean
  }>(),
  { retrying: false },
)

const emit = defineEmits<{ retry: [] }>()
const retryRequested = ref(false)
const retryBusy = computed(() => props.retrying || retryRequested.value)

function requestRetry(): void {
  if (retryBusy.value) return
  retryRequested.value = true
  emit('retry')
}

watch(
  () => props.retrying,
  (isRetrying, wasRetrying) => {
    if (wasRetrying && !isRetrying) retryRequested.value = false
  },
)
</script>

<template>
  <div
    data-testid="admin-async-message"
    :data-kind="kind"
    :aria-busy="kind === 'loading' ? 'true' : undefined"
    :role="kind === 'loading' ? 'status' : 'alert'"
    class="flex items-center justify-center gap-2.5 px-4 py-8 text-sm"
  >
    <span
      v-if="kind === 'loading'"
      data-testid="admin-async-spinner"
      class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-readion-border-strong border-t-readion-accent-label"
    />
    <svg
      v-else
      data-testid="admin-async-error-icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="shrink-0 text-readion-status-poor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
    <span :class="kind === 'error' ? 'text-readion-status-poor' : 'text-slate-400'">
      {{ message }}
    </span>
    <ReadionButton
      v-if="kind === 'error'"
      data-testid="admin-async-retry-btn"
      variant="secondary"
      :busy="retryBusy"
      busy-label="Retrying…"
      class="ml-1 !min-h-0 px-2.5 py-1 text-xs"
      @click="requestRetry"
    >
      Retry
    </ReadionButton>
  </div>
</template>
