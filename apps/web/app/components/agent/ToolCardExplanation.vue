<script setup lang="ts">
import { computed } from 'vue'
import ToolCard from '~/components/agent/ToolCard.vue'
import CitationChip from '~/components/CitationChip.vue'
import MarkdownBlock from '~/components/MarkdownBlock.vue'
import { resolveCitationLabel } from '~/composables/citationLabels'

type ChunkCitation = { chunkId?: string; sourceUrl?: string; primaryDomain?: string }
type ExplanationOutput = {
  correctOption?: string | null
  explanation?: string
  citations?: (string | ChunkCitation)[]
}

const props = defineProps<{ output: unknown; jobStatus?: string | null }>()

const data = computed(() => (props.output ?? {}) as ExplanationOutput)
const explanation = computed(() => data.value.explanation ?? '')
const correctAnswer = computed(() => data.value.correctOption?.toUpperCase() ?? null)

const citationLabels = computed(() =>
  (data.value.citations ?? []).map((citation) =>
    typeof citation === 'string'
      ? resolveCitationLabel(citation)
      : resolveCitationLabel(citation.primaryDomain, citation.sourceUrl),
  ),
)
</script>

<template>
  <ToolCard label="Explanation">
    <div
      v-if="correctAnswer"
      data-testid="explanation-correct-answer"
      class="mb-2 flex items-center gap-1.5 text-readion-status-good text-xs"
    >
      <span class="font-semibold">Correct answer: {{ correctAnswer }}</span>
    </div>

    <MarkdownBlock :source="explanation" />

    <div v-if="citationLabels.length" class="mt-2.5 flex flex-wrap gap-1.5">
      <CitationChip v-for="label in citationLabels" :key="label" :label="label" />
    </div>
  </ToolCard>
</template>
