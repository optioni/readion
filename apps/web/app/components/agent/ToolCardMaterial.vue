<script setup lang="ts">
import { computed } from 'vue'
import AgentChip from '~/components/agent/AgentChip.vue'
import MarkdownBlock from '~/components/MarkdownBlock.vue'

type MaterialOutput =
  | { status: 'inline'; content?: string }
  | { status: 'enqueued'; jobId?: string }

const props = defineProps<{ output: unknown; jobStatus?: string | null }>()

const data = computed(() => (props.output ?? {}) as MaterialOutput)

const isInline = computed(() => data.value.status === 'inline')
const content = computed(() => (data.value.status === 'inline' ? (data.value.content ?? '') : ''))

const isReady = computed(() => props.jobStatus === 'completed' || props.jobStatus === 'ready')
const isFailed = computed(() => props.jobStatus === 'failed' || props.jobStatus === 'timeout')
const isLoading = computed(() => !isInline.value && !isReady.value && !isFailed.value)
</script>

<template>
  <div
    data-testid="tool-result-card"
    class="mt-1.5 rounded-lg border border-readion-border-strong bg-readion-background-surface px-3.5 py-3"
  >
    <div class="mb-2 text-[10px] text-readion-accent-label uppercase tracking-wider">More material</div>

    <MarkdownBlock v-if="isInline" :source="content" />

    <template v-else>
      <div
        v-if="isLoading"
        data-testid="material-loading"
        class="mb-2 text-readion-text-muted text-xs"
      >
        Fetching more content…
      </div>

      <div class="flex flex-wrap gap-1.5">
        <AgentChip
          v-if="isLoading"
          data-testid="material-enqueued-chip"
          label="Job enqueued"
          tone="muted"
        />
        <AgentChip
          v-if="isReady"
          data-testid="material-ready-chip"
          label="New material ready"
          tone="good"
        />
        <AgentChip
          v-if="isFailed"
          label="Material unavailable"
          tone="warning"
        />
      </div>
    </template>
  </div>
</template>
