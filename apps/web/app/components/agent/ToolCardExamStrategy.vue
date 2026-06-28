<script setup lang="ts">
import { computed } from 'vue'
import MarkdownBlock from '~/components/MarkdownBlock.vue'

type ExamStrategyOutput = {
  domain?: string
  questionType?: string | null
  advice?: string
}

const props = defineProps<{ output: unknown; jobStatus?: string | null }>()

const data = computed(() => (props.output ?? {}) as ExamStrategyOutput)
const advice = computed(() => data.value.advice ?? '')
</script>

<template>
  <div
    data-testid="tool-result-card"
    class="mt-1.5 rounded-lg border border-readion-status-warning/30 bg-readion-status-warning/[0.06] px-3.5 py-3"
  >
    <div class="mb-2 flex items-center gap-1.5 text-[10px] text-readion-status-warning uppercase tracking-wider">
      <span>Exam strategy</span>
      <span v-if="data.domain" class="text-readion-text-muted normal-case tracking-normal">
        · {{ data.domain }}
      </span>
    </div>
    <MarkdownBlock :source="advice" />
  </div>
</template>
