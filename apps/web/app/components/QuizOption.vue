<script setup lang="ts">
import { computed } from 'vue'

export type QuizOptionState = 'rest' | 'selected' | 'correct' | 'incorrect' | 'dim'

const props = defineProps<{
  letter: string
  text: string
  state: QuizOptionState
}>()

defineEmits<{ select: [] }>()

const containerClass = computed<string>(() => {
  switch (props.state) {
    case 'selected':
      return 'border-readion-primary bg-readion-primary text-white'
    case 'correct':
      return 'border-readion-status-good text-readion-status-good'
    case 'incorrect':
      return 'border-readion-status-poor text-readion-status-poor'
    case 'dim':
      return 'border-readion-border-default text-readion-text-subtle opacity-70'
    default:
      return 'border-readion-border-default text-slate-300'
  }
})
</script>

<template>
  <button
    type="button"
    data-testid="quiz-option"
    :data-state="state"
    class="flex w-full items-start gap-3 rounded-md border bg-readion-background-base px-3.5 py-2.5 text-left text-sm leading-snug"
    :class="containerClass"
    @click="$emit('select')"
  >
    <span
      class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm font-mono text-[11px] font-semibold"
      :class="state === 'selected' ? 'bg-white/20 text-white/70' : 'bg-readion-background-surface'"
    >
      {{ letter }}
    </span>
    <span class="flex-1">{{ text }}</span>
  </button>
</template>
