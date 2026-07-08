<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant: 'hero' | 'standard'
  isStartingSession: boolean
  isStartingMockExam: boolean
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
  <div class="flex flex-shrink-0 items-center gap-2">
    <button
      type="button"
      data-testid="mock-exam-btn"
      class="cursor-pointer rounded-md px-3.5 py-2 font-medium text-xs disabled:cursor-not-allowed disabled:opacity-60"
      :class="mockClass"
      :disabled="props.isStartingMockExam"
      @click="emit('mock-exam')"
    >
      Mock Exam
    </button>
    <button
      type="button"
      data-testid="start-session-btn"
      class="cursor-pointer rounded-md px-4 py-2 font-semibold text-xs disabled:cursor-not-allowed disabled:opacity-60"
      :class="startClass"
      :disabled="props.isStartingSession"
      @click="emit('start-session')"
    >
      Start Session →
    </button>
  </div>
</template>
