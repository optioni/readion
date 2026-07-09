<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import DomainScoreBar from '~/components/DomainScoreBar.vue'
import { suppressDomain } from '~/composables/progressApi'
import { progressQueryKeys } from '~/composables/progressQueryKeys'
import type { StatusColorKey } from '~/composables/statusColor'

const props = defineProps<{
  domain: string
  score: number | null
  status: StatusColorKey | null
  hasData: boolean
  delta: number | null
  enrollmentId: string
  mastered: boolean
}>()

const queryClient = useQueryClient()

// Optimistic-only flag: gives instant feedback after the mutation resolves, in this same mount,
// without waiting on the invalidated queries to refetch. The authoritative source of truth is the
// `mastered` prop (derived from a fresh fetch by the parent) — this flag never survives a reload,
// which is exactly the behaviour fixed here (the old bug was a local ref used as the *only* source
// of truth, so it silently reset on reload instead of reflecting fetched data).
const justMastered = ref(false)
const isMastered = computed(() => props.mastered || justMastered.value)

async function markMastered() {
  await suppressDomain(props.enrollmentId, { domain: props.domain })
  justMastered.value = true
  await queryClient.invalidateQueries({ queryKey: progressQueryKeys.weakAreas(props.enrollmentId) })
  await queryClient.invalidateQueries({
    queryKey: progressQueryKeys.reviewQueue(props.enrollmentId),
  })
}
</script>

<template>
  <div
    data-testid="progress-domain-row"
    :data-state="isMastered ? 'mastered' : undefined"
    class="flex items-center justify-between gap-3 py-2"
  >
    <DomainScoreBar
      class="flex-1"
      :domain="domain"
      :score="score"
      :status="status"
      :has-data="hasData"
      :delta="delta"
      :mastered="isMastered"
    />

    <button
      v-if="!isMastered"
      type="button"
      data-testid="mark-mastered-button"
      class="rounded px-2 py-1 text-slate-400 text-xs transition-colors hover:text-slate-200"
      @click="markMastered"
    >
      Mark mastered
    </button>
  </div>
</template>
