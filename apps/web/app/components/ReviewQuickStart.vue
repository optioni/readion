<script setup lang="ts">
import { computed } from 'vue'
import { reviewRunPath } from '~/composables/runnerRoutes'

const props = defineProps<{ enrollmentId: string; dueCount: number; hero?: boolean }>()
const router = useRouter()

const pillClass = computed(() =>
  props.hero
    ? 'bg-white/15 text-white border border-white/25'
    : 'bg-readion-primary/15 text-readion-primary-300 border border-readion-primary/30',
)

function startReview() {
  router.push(reviewRunPath(props.enrollmentId))
}
</script>

<template>
  <div data-testid="review-quickstart" class="flex items-center gap-2.5 text-xs">
    <span class="flex items-baseline gap-1">
      <span class="font-bold text-xl leading-none">{{ props.dueCount }}</span>
      <span class="opacity-70">reviews due</span>
    </span>
    <button
      type="button"
      data-testid="review-start-btn"
      class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-medium"
      :class="pillClass"
      @click="startReview"
    >
      <svg
        data-testid="review-play-icon"
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <polygon points="4,2 10,6 4,10" fill="currentColor" />
      </svg>
      5-min review
    </button>
  </div>
</template>
