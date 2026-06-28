<script setup lang="ts">
import { reviewRunPath } from '~/composables/runnerRoutes'
import { enrollmentReviewControllerStart } from '~~/src/api/enrollment-review/enrollment-review'

const props = defineProps<{ enrollmentId: string; dueCount: number }>()
const router = useRouter()

async function startReview() {
  await enrollmentReviewControllerStart(props.enrollmentId)
  router.push(reviewRunPath(props.enrollmentId))
}
</script>

<template>
  <div
    data-testid="review-quickstart"
    class="mt-3 flex items-center justify-between rounded-md bg-black/20 px-3 py-2 text-xs"
  >
    <span>{{ props.dueCount }} reviews due</span>
    <button
      type="button"
      data-testid="review-start-btn"
      class="cursor-pointer rounded-md bg-readion-status-good px-3.5 py-1.5 font-semibold text-readion-background-base text-xs"
      @click="startReview"
    >
      5-minute review
    </button>
  </div>
</template>
