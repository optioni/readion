<script setup lang="ts">
import type { SessionItemResponse } from '@readion/shared'
import { computed, nextTick, ref } from 'vue'
import CitationChip from '~/components/CitationChip.vue'
import MarkdownBlock from '~/components/MarkdownBlock.vue'
import ReadionButton from '~/components/ReadionButton.vue'
import { readingCitationLabels } from '~/composables/citationLabels'
import { parseSessionItemContent } from '~/composables/parseSessionItemContent'
import { goDeeperOnItem } from '~/composables/sessionViewApi'

const props = defineProps<{
  sessionId: string
  item: SessionItemResponse
  domain?: string
}>()

const emit = defineEmits<{ advance: [index: number] }>()

const parsed = computed(() => parseSessionItemContent(props.item))
const tldr = computed(() =>
  parsed.value.kind === 'reading' ? parsed.value.markdown : props.item.content,
)

const citations = computed(() =>
  readingCitationLabels(props.item.sourceChunkIds, props.item.supportingSpans),
)

const expandedContent = ref<string | null>(null)
const expandedContentElement = ref<HTMLElement | null>(null)
const isLoading = ref(false)
const expansionError = ref<string | null>(null)

async function readFull() {
  if (expandedContent.value !== null || isLoading.value) {
    return
  }
  expansionError.value = null
  isLoading.value = true
  try {
    const result = await goDeeperOnItem(props.sessionId, props.item.index)
    expandedContent.value = result.expandedContent
    await nextTick()
    expandedContentElement.value?.focus()
  } catch {
    expansionError.value = 'Couldn’t load the full explanation.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    data-testid="reading-block"
    class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-6 py-5"
  >
    <div class="mb-3.5 flex items-center gap-2">
      <span
        class="rounded-full border border-readion-accent-label/20 bg-readion-accent-label/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-readion-accent-label"
      >
        Reading
      </span>
      <span v-if="domain" class="text-readion-text-muted text-xs">{{ domain }}</span>
    </div>

    <div class="mb-3">
      <div class="mb-2 flex items-center gap-1.5">
        <span class="font-medium text-[10px] text-readion-text-muted uppercase tracking-wider">TL;DR</span>
        <div class="h-px flex-1 bg-readion-border-strong" />
      </div>
      <MarkdownBlock data-testid="reading-tldr" :source="tldr" />
    </div>

    <div
      v-if="expandedContent !== null"
      ref="expandedContentElement"
      data-testid="reading-expanded-content"
      class="mb-3 rounded-lg border border-readion-border-default bg-readion-background-base px-4 py-3.5"
      tabindex="-1"
    >
      <MarkdownBlock :source="expandedContent" />
    </div>

    <ReadionButton
      v-else
      data-testid="read-full-explanation-button"
      variant="secondary"
      class="mb-3 min-h-8 px-3 py-1.5 text-xs"
      :busy="isLoading"
      busy-label="Loading…"
      :aria-describedby="expansionError ? 'reading-expansion-error' : undefined"
      @click="readFull"
    >
      {{ expansionError ? 'Retry' : 'Read full explanation ↓' }}
    </ReadionButton>
    <p
      v-if="expansionError"
      id="reading-expansion-error"
      data-testid="reading-expansion-error"
      class="mb-3 text-readion-status-poor text-xs"
      role="alert"
    >
      {{ expansionError }}
    </p>

    <div class="mb-4 flex flex-wrap gap-1.5">
      <CitationChip v-for="citation in citations" :key="citation" :label="citation" />
    </div>

    <button
      type="button"
      data-testid="advance-item-button"
      class="rounded-md border border-readion-border-strong px-3 py-1.5 text-readion-text-muted text-xs"
      @click="emit('advance', item.index)"
    >
      Continue &#8594;
    </button>
  </div>
</template>
