<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    empty?: boolean
    error?: string
    refreshing?: boolean
    retrying?: boolean
    loadingLabel?: string
    refreshLabel?: string
    emptyLabel?: string
    retryLabel?: string
    retryingLabel?: string
    ariaLabel?: string
  }>(),
  {
    loading: false,
    empty: false,
    error: undefined,
    refreshing: false,
    retrying: false,
    loadingLabel: 'Loading…',
    refreshLabel: 'Refreshing…',
    emptyLabel: 'Nothing to show.',
    retryLabel: 'Retry',
    retryingLabel: 'Retrying…',
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{ retry: [] }>()

const retryRequested = ref(false)
const _state = computed(() => {
  if (props.loading) return 'loading'
  if (props.error) return 'error'
  if (props.empty) return 'empty'
  if (props.refreshing) return 'refreshing'
  return 'content'
})
const retryBusy = computed(() => props.retrying || retryRequested.value)
const _busy = computed(() => props.loading || props.refreshing || retryBusy.value)

function _requestRetry() {
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
    data-testid="readion-async-region"
    :data-state="_state"
    :aria-label="ariaLabel"
    :aria-busy="_busy ? 'true' : undefined"
  >
    <div
      v-if="_state === 'loading'"
      data-testid="readion-async-loading"
      class="flex min-h-24 flex-col justify-center gap-3"
    >
      <slot name="loading">
        <div
          aria-hidden="true"
          data-testid="readion-async-skeleton"
          class="flex w-full animate-pulse flex-col gap-3 motion-reduce:animate-none"
        >
          <div class="h-4 w-full rounded-md bg-readion-background-surface" />
          <div class="h-4 w-full rounded-md bg-readion-background-surface" />
          <div class="h-4 w-2/3 rounded-md bg-readion-background-surface" />
        </div>
      </slot>
      <div class="sr-only" role="status">
        {{ loadingLabel }}
      </div>
    </div>

    <div
      v-else-if="_state === 'error'"
      data-testid="readion-async-error"
      class="flex min-h-24 flex-col items-start justify-center gap-3 rounded-lg border border-readion-status-poor/30 bg-readion-status-poor/10 px-4 py-3 text-sm"
      role="alert"
    >
      <p class="text-readion-status-poor">
        <slot name="error">{{ error }}</slot>
      </p>
      <ReadionButton
        data-testid="readion-async-retry"
        variant="secondary"
        :busy="retryBusy"
        :busy-label="retryingLabel"
        @click="_requestRetry"
      >
        {{ retryLabel }}
      </ReadionButton>
    </div>

    <div
      v-else-if="_state === 'empty'"
      data-testid="readion-async-empty"
      class="flex min-h-24 items-center justify-center text-center text-readion-text-secondary text-sm"
    >
      <slot name="empty">{{ emptyLabel }}</slot>
    </div>

    <template v-else>
      <slot />
      <div
        v-if="refreshing"
        data-testid="readion-async-refresh"
        class="mt-3 inline-flex items-center gap-2 text-readion-text-secondary text-sm"
        role="status"
      >
        <span
          aria-hidden="true"
          class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
        {{ refreshLabel }}
      </div>
    </template>
  </div>
</template>
