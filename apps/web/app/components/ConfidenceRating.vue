<script setup lang="ts">
defineProps<{ modelValue: number | undefined; topic?: string }>()

defineEmits<{ 'update:modelValue': [value: number] }>()

const points = [1, 2, 3, 4, 5] as const
const faces = ['😕', '🤔', '😐', '🙂', '😎']
</script>

<template>
  <div
    data-testid="confidence-rating"
    class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-4"
  >
    <p class="mb-3 text-readion-text-secondary text-xs">
      <template v-if="topic">How confident do you feel about <strong class="text-readion-text-primary">{{ topic }}</strong>?</template>
      <template v-else>How confident do you feel?</template>
    </p>
    <div class="mb-2 flex gap-1.5">
      <button
        v-for="(n, i) in points"
        :key="n"
        type="button"
        :data-testid="`confidence-option-${n}`"
        :aria-pressed="modelValue === n"
        class="flex-1 rounded-md border py-2 text-lg"
        :class="
          modelValue === n
            ? 'border-readion-primary bg-readion-primary'
            : 'border-readion-border-strong bg-readion-background-base'
        "
        @click="$emit('update:modelValue', n)"
      >
        {{ faces[i] }}
      </button>
    </div>
    <div class="flex justify-between text-[10px] text-readion-text-subtle">
      <span>Not at all</span>
      <span>Very confident</span>
    </div>
  </div>
</template>
