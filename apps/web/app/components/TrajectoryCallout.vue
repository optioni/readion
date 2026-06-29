<script setup lang="ts">
defineProps<{
  weeksToReady: number | null
}>()
</script>

<template>
  <div
    v-if="weeksToReady !== null"
    data-testid="trajectory-callout"
    class="flex items-center gap-2 rounded-lg border border-readion-primary/20 bg-readion-primary/10 px-4 py-3"
  >
    <span class="text-readion-primary text-sm">
      Exam-ready in ~{{ weeksToReady }} {{ weeksToReady === 1 ? 'week' : 'weeks' }}
    </span>
  </div>
</template>
