<script setup lang="ts">
import { computed, ref } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { reviewRunPath } from '~/composables/runnerRoutes'

const props = defineProps<{ enrollmentId: string; dueCount: number; hero?: boolean }>()
const router = useRouter()
const isStarting = ref(false)

const pillClass = computed(() =>
  props.hero
    ? 'bg-white/15 text-white border border-white/25'
    : 'bg-readion-primary/15 text-readion-primary-300 border border-readion-primary/30',
)

async function startReview() {
  if (isStarting.value) return
  isStarting.value = true
  try {
    await router.push({
      path: reviewRunPath(props.enrollmentId),
      query: { autostart: '1' },
    })
  } finally {
    isStarting.value = false
  }
}
</script>

<template>
  <div data-testid="review-quickstart" class="flex items-center gap-2.5 text-xs">
    <span class="flex items-baseline gap-1">
      <span class="font-bold text-xl leading-none">{{ props.dueCount }}</span>
      <span class="opacity-70">reviews due</span>
    </span>
    <ReadionButton
      data-testid="review-start-btn"
      variant="secondary"
      :busy="isStarting"
      busy-label="Starting…"
      class="min-h-0 whitespace-nowrap rounded-full px-3 py-1"
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
    </ReadionButton>
  </div>
</template>
