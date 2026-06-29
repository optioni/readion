<script setup lang="ts">
import type { CertificationFieldCitation } from '@readion/shared'

defineProps<{ citation: CertificationFieldCitation }>()
</script>

<template>
  <div
    data-testid="field-citation"
    class="flex flex-col gap-1 rounded-lg bg-readion-background-base px-3 py-2"
  >
    <span class="text-slate-300 text-xs italic">“{{ citation.passage }}”</span>
    <a
      :href="citation.url"
      class="break-all text-readion-primary text-xs"
      target="_blank"
      rel="noreferrer"
    >
      {{ citation.url }}
    </a>
  </div>
</template>
