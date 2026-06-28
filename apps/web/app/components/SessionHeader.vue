<script setup lang="ts">
import { computed } from 'vue'
import { useCertDetail } from '~/composables/useCertDetail'

const props = defineProps<{
  userCertificationId: string
  elapsed: string
  completedCount: number
  totalCount: number
}>()

const emit = defineEmits<{ end: [] }>()

const { code, name } = useCertDetail(props.userCertificationId)

const percent = computed(() =>
  props.totalCount === 0 ? 0 : (props.completedCount / props.totalCount) * 100,
)
</script>

<template>
  <div
    data-testid="session-header"
    class="flex flex-shrink-0 items-center gap-5 border-readion-border-strong border-b bg-readion-background-surface px-7 py-3"
  >
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex items-center justify-between">
        <div class="flex min-w-0 items-center gap-2">
          <span
            data-testid="session-cert-code"
            class="rounded-sm bg-readion-background-elevated px-1.5 py-0.5 font-mono text-[11px] text-readion-text-muted"
          >
            {{ code }}
          </span>
          <span class="truncate text-readion-text-secondary text-xs">{{ name }}</span>
        </div>

        <div class="flex flex-shrink-0 items-center gap-1.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            class="text-readion-text-muted"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span
            data-testid="session-timer"
            class="font-mono text-[13px] text-readion-text-muted"
          >{{ elapsed }}</span>
          <div class="mx-1 h-3 w-px bg-readion-border-strong" />
          <span data-testid="session-progress" class="text-readion-text-secondary text-xs">
            {{ completedCount }}<span class="text-readion-text-muted">/{{ totalCount }}</span>
          </span>
        </div>
      </div>

      <div class="h-[3px] rounded-full bg-readion-border-strong">
        <div
          data-testid="session-progress-bar"
          class="h-full rounded-full bg-readion-accent-label transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
    </div>

    <button
      type="button"
      data-testid="end-session-button"
      class="flex-shrink-0 rounded-md border border-readion-border-strong px-3 py-1.5 text-readion-text-muted text-xs"
      @click="emit('end')"
    >
      End session
    </button>
  </div>
</template>
