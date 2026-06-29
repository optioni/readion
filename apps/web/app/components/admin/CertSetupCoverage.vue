<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { readCoverageEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { statusColorForScore } from '~/composables/statusColor'
import { certificationCoverageControllerCoverage } from '~~/src/api/certification-coverage/certification-coverage'

const props = defineProps<{ certId: string }>()

const coverageQuery = useQuery({
  queryKey: computed(() => adminQueryKeys.coverage(props.certId)),
  queryFn: async () =>
    readCoverageEnvelope(await certificationCoverageControllerCoverage(props.certId)),
  enabled: computed(() => Boolean(props.certId)),
})

const report = computed(() => coverageQuery.data.value ?? null)

function percent(count: number, threshold: number): number {
  if (threshold <= 0) return 100
  return Math.min(100, (count / threshold) * 100)
}

function barWidth(count: number, threshold: number): string {
  return `${percent(count, threshold)}%`
}

function barColorClass(count: number, threshold: number): string {
  return `bg-readion-status-${statusColorForScore(percent(count, threshold))}`
}
</script>

<template>
  <div data-testid="cert-coverage" class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h2 class="font-semibold text-base text-white">Go-live coverage</h2>
      <p class="text-slate-400 text-xs">
        Read-only — a draft goes live automatically once every domain meets its threshold.
      </p>
    </header>

    <template v-if="report">
      <ul class="flex flex-col gap-3">
        <li
          v-for="domain in report.domains"
          :key="domain.name"
          data-testid="coverage-domain-bar"
          :data-domain="domain.name"
          class="flex flex-col gap-1"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-100">{{ domain.name }}</span>
            <span class="font-mono text-slate-400">
              {{ domain.chunkCount }} / {{ domain.chunkThreshold }}
              <span :data-testid="`coverage-met-${domain.name}`" class="ml-2">
                {{ domain.met ? 'Met' : 'Below threshold' }}
              </span>
            </span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-readion-background-surface">
            <div
              data-testid="coverage-bar-fill"
              class="h-full rounded-full transition-all"
              :class="barColorClass(domain.chunkCount, domain.chunkThreshold)"
              :style="{ width: barWidth(domain.chunkCount, domain.chunkThreshold) }"
            />
          </div>
        </li>
      </ul>

      <div
        data-testid="cert-coverage-overall"
        class="flex items-center justify-between rounded-lg border border-readion-background-surface px-4 py-3 text-sm"
      >
        <span class="text-slate-100">Overall</span>
        <span class="font-mono text-slate-400">
          {{ report.totalChunks }} / {{ report.totalThreshold }} chunks ·
          {{ report.met ? 'Ready to go live' : 'Building coverage' }}
        </span>
      </div>
    </template>
  </div>
</template>
