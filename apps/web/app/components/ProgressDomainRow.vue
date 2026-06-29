<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import DeltaBadge from '~/components/DeltaBadge.vue'
import { suppressDomain } from '~/composables/progressApi'
import { progressQueryKeys } from '~/composables/progressQueryKeys'
import type { StatusColorKey } from '~/composables/statusColor'
import { statusTextColorClass } from '~/composables/statusColor'

const props = defineProps<{
  domain: string
  score: number | null
  status: StatusColorKey | null
  hasData: boolean
  delta: number | null
  enrollmentId: string
}>()

const queryClient = useQueryClient()
const mastered = ref(false)

async function markMastered() {
  await suppressDomain(props.enrollmentId, { domain: props.domain })
  mastered.value = true
  await queryClient.invalidateQueries({ queryKey: progressQueryKeys.weakAreas(props.enrollmentId) })
}

const scoreColorClass = (status: StatusColorKey) => statusTextColorClass(status)
</script>

<template>
  <div
    data-testid="progress-domain-row"
    :data-state="mastered ? 'mastered' : undefined"
    class="flex items-center justify-between gap-3 py-2"
  >
    <span class="flex-1 text-sm text-slate-200">{{ domain }}</span>

    <span
      v-if="hasData && status !== null && score !== null"
      :class="scoreColorClass(status)"
      class="font-medium text-sm"
    >
      {{ score }}%
    </span>
    <span v-else class="text-slate-500 text-xs">No data yet</span>

    <span
      v-if="delta !== null"
      data-testid="domain-delta"
    >
      <DeltaBadge :value="delta" />
    </span>

    <button
      v-if="!mastered"
      type="button"
      data-testid="mark-mastered-button"
      class="rounded px-2 py-1 text-slate-400 text-xs transition-colors hover:text-slate-200"
      @click="markMastered"
    >
      Mark mastered
    </button>
    <span v-else class="text-slate-500 text-xs">Mastered</span>
  </div>
</template>
