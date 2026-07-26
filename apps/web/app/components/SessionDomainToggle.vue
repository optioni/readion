<script setup lang="ts">
import { computed } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { statusColorForScore } from '~/composables/statusColor'

const props = defineProps<{
  name: string
  score: number | undefined
  selected: boolean
}>()

defineEmits<{ toggle: [] }>()

const statusColorClass: Record<string, string> = {
  poor: 'text-readion-status-poor',
  warning: 'text-readion-status-warning',
  medium: 'text-readion-status-warning',
  good: 'text-readion-status-good',
}

const scoreColorClass = computed(() =>
  props.score === undefined ? '' : statusColorClass[statusColorForScore(props.score)],
)
</script>

<template>
  <ReadionButton
    :data-testid="`domain-toggle-${name}`"
    variant="toggle"
    :selected="selected"
    class="w-full justify-start rounded-none border-x-0 border-t-0 px-0 py-2 text-left last:border-b-0"
    @click="$emit('toggle')"
  >
    <span
      class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border"
      :class="selected ? 'border-readion-primary bg-readion-primary' : 'border-readion-border-strong'"
    >
      <svg v-if="selected" width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path
          d="M2 4.5l2 2 3-3"
          stroke="#fff"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="flex-1 text-xs" :class="selected ? 'text-slate-100' : 'text-slate-300'">
      {{ name }}
    </span>
    <span v-if="score !== undefined" class="font-medium text-[11px]" :class="scoreColorClass">
      {{ score }}%
    </span>
  </ReadionButton>
</template>
