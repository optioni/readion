<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '~/composables/renderMarkdown'

const props = defineProps<{ source: string }>()

const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- renderMarkdown escapes raw HTML and rejects unsafe link protocols, so this binding is safe. -->
  <div class="readion-markdown text-readion-text-secondary text-sm leading-relaxed" v-html="html" />
</template>
