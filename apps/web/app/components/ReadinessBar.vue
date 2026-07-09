<script setup lang="ts">
import { computed } from 'vue'
import { statusColorForScore } from '~/composables/statusColor'

const props = defineProps<{ score: number | null; hero?: boolean }>()

const trackClass = computed(() => (props.hero ? 'bg-white/15' : 'bg-readion-background-surface'))

const fillClass = computed(() =>
  props.hero ? 'bg-white/85' : `bg-readion-status-${statusColorForScore(props.score ?? 0)}`,
)
</script>

<template>
  <div data-testid="readiness-bar" class="mt-2 h-[3px] w-full overflow-hidden rounded-full" :class="trackClass">
    <div
      v-if="score !== null"
      data-testid="readiness-bar-fill"
      class="h-full rounded-full"
      :class="fillClass"
      :style="{ width: `${score}%` }"
    />
  </div>
</template>
