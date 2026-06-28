<script setup lang="ts">
import { computed } from 'vue'
import { resolveToolCard } from '~/components/agent/toolCardRegistry'

const props = defineProps<{
  part: { toolName: string; output: unknown }
  jobStatus?: string | null
}>()

const card = computed(() => resolveToolCard(props.part.toolName))
</script>

<template>
  <component
    :is="card"
    v-if="card"
    :output="props.part.output"
    :job-status="props.jobStatus ?? null"
  />
</template>
