<script setup lang="ts">
import { computed } from 'vue'
import { useCertDetail } from '~/composables/useCertDetail'

const props = withDefaults(
  defineProps<{
    userCertificationId: string
    current: number
    total: number
    timeStr?: string
    timeUrgent?: boolean
  }>(),
  {
    timeStr: '5:00',
    timeUrgent: false,
  },
)

const { code } = useCertDetail(props.userCertificationId)

const percent = computed(() => (props.total === 0 ? 0 : (props.current / props.total) * 100))

const timerClass = computed<string>(() =>
  props.timeUrgent
    ? 'border-readion-status-poor/30 bg-readion-status-poor/10 text-readion-status-poor'
    : 'border-readion-border-strong bg-readion-background-surface text-readion-text-muted',
)
</script>

<template>
  <div
    data-testid="review-header"
    class="flex min-h-13 min-w-0 flex-shrink-0 items-center gap-2 border-readion-border-strong border-b bg-readion-background-elevated px-3 sm:h-13 sm:gap-4 sm:px-7"
  >
    <NuxtLink
      to="/"
      class="flex flex-shrink-0 items-center gap-1.5 text-readion-text-muted text-xs hover:text-readion-text-secondary"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      <span class="hidden sm:inline">Dashboard</span>
    </NuxtLink>

    <div class="h-4 w-px flex-shrink-0 bg-readion-border-strong" />

    <div class="flex flex-shrink-0 items-center gap-1.5">
      <span
        data-testid="review-header-cert-chip"
        class="rounded-sm border border-readion-border-strong bg-readion-background-surface px-1.5 py-0.5 font-mono text-[11px] text-readion-text-muted"
      >
        {{ code }}
      </span>
      <span class="hidden text-readion-text-secondary text-xs sm:inline">Quick review</span>
    </div>

    <div class="flex-1" />

    <div class="flex flex-shrink-0 items-center gap-2.5">
      <div
        data-testid="review-header-progress"
        class="h-[3px] w-16 rounded-full bg-readion-border-strong sm:w-[120px]"
      >
        <div
          class="h-full rounded-full bg-readion-accent-label transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <span class="font-mono text-readion-text-secondary text-xs">
        <span class="font-medium text-readion-text-primary">{{ current }}</span>
        <span class="text-readion-text-muted">/{{ total }}</span>
      </span>
    </div>

    <span
      data-testid="review-header-timer"
      class="flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[12px]"
      :class="timerClass"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
        />
        <path d="M12 6v6l4 2" />
      </svg>
      {{ timeStr }}
    </span>
  </div>
</template>
