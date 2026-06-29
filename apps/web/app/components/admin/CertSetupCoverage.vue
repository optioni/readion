<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import CertSetupCoverageBar from '~/components/admin/CertSetupCoverageBar.vue'
import { readCoverageEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { certificationCoverageControllerCoverage } from '~~/src/api/certification-coverage/certification-coverage'

const props = defineProps<{ certId: string }>()

const coverageQuery = useQuery({
  queryKey: computed(() => adminQueryKeys.coverage(props.certId)),
  queryFn: async () =>
    readCoverageEnvelope(await certificationCoverageControllerCoverage(props.certId)),
  enabled: computed(() => Boolean(props.certId)),
})

const report = computed(() => coverageQuery.data.value ?? null)
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
        <li v-for="domain in report.domains" :key="domain.name">
          <CertSetupCoverageBar
            :name="domain.name"
            :chunk-count="domain.chunkCount"
            :chunk-threshold="domain.chunkThreshold"
            :met="domain.met"
          />
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
