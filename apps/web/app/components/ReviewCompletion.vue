<script setup lang="ts">
import type { SessionSummaryResponse } from '@readion/shared'
import SessionSummaryBody from '~/components/SessionSummaryBody.vue'

withDefaults(
  defineProps<{
    summary: SessionSummaryResponse
    drillNoMisses?: boolean
  }>(),
  { drillNoMisses: false },
)

const emit = defineEmits<{
  drill: []
  back: []
}>()
</script>

<template>
  <div
    data-testid="session-summary-page"
    class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-9 py-7"
  >
    <SessionSummaryBody
      :summary="summary"
      :drill-no-misses="drillNoMisses"
      :hide-ask-agent="true"
      @drill="emit('drill')"
      @back="emit('back')"
    />
  </div>
</template>
