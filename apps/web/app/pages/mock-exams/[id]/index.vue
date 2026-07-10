<script setup lang="ts">
import { computed } from 'vue'
import MockExamSceneRouter from '~/components/MockExamSceneRouter.vue'
import { useMockExamAttempt } from '~/composables/useMockExamAttempt'

definePageMeta({ layout: false })

const route = useRoute()
const examId = computed(() => String(route.params.id))

const { exam, isLoading, isError } = useMockExamAttempt(examId.value)
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col">
    <div
      v-if="isLoading && !exam"
      data-testid="mock-exam-loading"
      class="flex flex-1 items-center justify-center text-readion-text-muted text-sm"
    >
      Loading exam…
    </div>

    <div
      v-else-if="isError || !exam"
      data-testid="mock-exam-error"
      class="flex flex-1 items-center justify-center text-readion-status-warning text-sm"
    >
      This exam could not be loaded.
    </div>

    <MockExamSceneRouter v-else :exam="exam" :exam-id="examId" />
  </div>
</template>
