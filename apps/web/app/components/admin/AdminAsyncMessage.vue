<script setup lang="ts">
defineProps<{
  kind: 'loading' | 'error'
  message: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    data-testid="admin-async-message"
    :data-kind="kind"
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
    <button
      v-if="kind === 'error'"
      type="button"
      data-testid="admin-async-retry-btn"
      class="ml-1 rounded-md border border-readion-status-poor/35 px-2.5 py-1 font-medium text-readion-status-poor text-xs transition-colors hover:bg-readion-status-poor/10"
      @click="emit('retry')"
    >
      Retry
    </button>
  </div>
</template>
