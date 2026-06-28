<script setup lang="ts">
import { computed } from 'vue'
import ToolCard from '~/components/agent/ToolCard.vue'
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
  <ToolCard label="Exam strategy" tone="warning">
    <template #label>
      <span>Exam strategy</span>
      <span v-if="data.domain" class="text-readion-text-muted normal-case tracking-normal">
        · {{ data.domain }}
      </span>
    </template>
    <MarkdownBlock :source="advice" />
  </ToolCard>
</template>
