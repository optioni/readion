<script setup lang="ts">
// Honest placeholder: no backend lists, reads, or resolves quarantined items — the quarantine path
// only evicts the LLM cache and increments a metric. So this section fetches nothing and fabricates
// no items, verdicts, or counts.
</script>

<template>
  <section data-testid="admin-review-queue-page" class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">Review queue</h1>

    <div
      data-testid="review-queue-placeholder"
      class="rounded-lg border border-readion-background-surface border-dashed bg-readion-background-surface/40 px-6 py-10 text-center text-slate-400 text-sm"
    >
      Quarantine review is not yet available. There is currently no backend to list or resolve
      quarantined items.
    </div>
  </section>
</template>
