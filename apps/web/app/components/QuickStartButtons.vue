<script setup lang="ts">
import { computed } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'

const props = defineProps<{
  variant: 'hero' | 'standard'
  isStartingSession: boolean
  isStartingMockExam: boolean
  sessionError?: string | null
  mockExamError?: string | null
}>()
const emit = defineEmits<{ 'start-session': []; 'mock-exam': [] }>()

const isHero = computed(() => props.variant === 'hero')

const startClass = computed(() =>
  isHero.value ? 'bg-white text-readion-primary' : 'bg-[#334155] text-slate-200',
)

const mockClass = computed(() =>
  isHero.value
    ? 'bg-readion-primary-hover text-readion-primary-300'
    : 'border border-[#334155] bg-readion-background-base text-slate-400',
)
</script>

<template>
  <div class="flex flex-shrink-0 flex-col items-end gap-2">
    <div class="flex items-center gap-2">
      <ReadionButton
        data-testid="mock-exam-btn"
        variant="secondary"
        busy-label="Starting…"
        :busy="props.isStartingMockExam"
        :class="mockClass"
        @click="emit('mock-exam')"
      >
        Mock exam
      </ReadionButton>
      <ReadionButton
        data-testid="start-session-btn"
        busy-label="Starting…"
        :busy="props.isStartingSession"
        :class="startClass"
        @click="emit('start-session')"
      >
        Start Session →
      </ReadionButton>
    </div>
    <p
      v-if="props.sessionError || props.mockExamError"
      class="max-w-xs text-right text-readion-status-poor text-xs"
      role="alert"
    >
      {{ props.sessionError ?? props.mockExamError }}
    </p>
  </div>
</template>
