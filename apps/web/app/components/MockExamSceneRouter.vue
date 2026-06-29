<script setup lang="ts">
import type { MockExamResponse } from '@readion/shared'
import { computed, ref } from 'vue'
import MockExamActiveScene from '~/components/MockExamActiveScene.vue'
import MockExamPreparingScene from '~/components/MockExamPreparingScene.vue'
import MockExamResultsScene from '~/components/MockExamResultsScene.vue'
import MockExamReviewScene from '~/components/MockExamReviewScene.vue'
import { selectMockExamScene } from '~/composables/mockExamScene'
import { useCertDetail } from '~/composables/useCertDetail'

const props = defineProps<{
  exam: MockExamResponse
  examId: string
}>()

const { name, code, questionCount } = useCertDetail(props.exam.userCertificationId)

const scene = computed(() => selectMockExamScene(props.exam))
const reviewMode = ref(false)
</script>

<template>
  <div data-testid="mock-exam-page" class="flex min-h-0 flex-1 flex-col">
    <MockExamPreparingScene
      v-if="scene === 'preparing'"
      :exam="exam"
      :cert-code="code"
      :cert-name="name"
      :target-count="questionCount ?? undefined"
    />

    <MockExamActiveScene
      v-else-if="scene === 'active'"
      :exam="exam"
      :exam-id="examId"
      :cert-code="code"
      :cert-name="name"
    />

    <MockExamResultsScene
      v-else-if="scene === 'results' && !reviewMode"
      :exam="exam"
      :exam-id="examId"
      @review="reviewMode = true"
    />

    <MockExamReviewScene
      v-else-if="scene === 'results' && reviewMode"
      :exam="exam"
      :cert-code="code"
      :cert-name="name"
      @back="reviewMode = false"
    />
  </div>
</template>
