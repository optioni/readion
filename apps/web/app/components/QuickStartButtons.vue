<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ variant: 'hero' | 'standard' }>()
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
  <div class="flex flex-col items-end gap-1.5">
    <button
      type="button"
      data-testid="start-session-btn"
      class="cursor-pointer rounded-md px-3.5 py-1.5 font-semibold text-xs"
      :class="startClass"
      @click="emit('start-session')"
    >
      Start Session
    </button>
    <button
      type="button"
      data-testid="mock-exam-btn"
      class="cursor-pointer rounded-md px-3.5 py-1.5 font-semibold text-xs"
      :class="mockClass"
      @click="emit('mock-exam')"
    >
      Mock Exam
    </button>
  </div>
</template>
