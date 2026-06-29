<script setup lang="ts">
import { computed } from 'vue'
import AccuracyBars from '~/components/AccuracyBars.vue'
import CardPanel from '~/components/CardPanel.vue'
import CertTabs from '~/components/CertTabs.vue'
import ProgressDomainRow from '~/components/ProgressDomainRow.vue'
import ProgressSessionHistoryTable from '~/components/ProgressSessionHistoryTable.vue'
import ReadinessTrend from '~/components/ReadinessTrend.vue'
import TrajectoryCallout from '~/components/TrajectoryCallout.vue'
import { useProgressData } from '~/composables/useProgressData'

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

const {
  notFound,
  certName,
  certProvider,
  domainScores,
  trend,
  accuracySeries,
  weeksToReady,
  historyRows,
  switcher,
  isLoading,
} = useProgressData(enrollmentId.value)

const sessionCount = computed(() => historyRows.value.length)
const questionsAnswered = computed(() =>
  historyRows.value.reduce((sum, r) => sum + (r.questionsAnswered ?? 0), 0),
)
</script>

<template>
  <section data-testid="progress-page" class="mx-auto max-w-[720px]">
    <div
      v-if="notFound"
      data-testid="progress-not-found"
      class="flex flex-col items-center gap-3 rounded-xl border border-readion-background-surface border-dashed px-6 py-16 text-center"
    >
      <p class="font-medium text-lg text-slate-200">Progress not found</p>
      <p class="max-w-sm text-slate-400 text-sm">
        This enrollment does not exist or is not available to you.
      </p>
    </div>

    <template v-else>
      <header class="mb-6">
        <p class="mb-1 font-medium text-[11px] text-slate-400 uppercase tracking-wider">
          Progress
        </p>
        <div v-if="isLoading" class="space-y-2">
          <div class="h-7 w-64 animate-pulse rounded bg-readion-background-surface" />
          <div class="h-4 w-32 animate-pulse rounded bg-readion-background-surface" />
        </div>
        <template v-else>
          <h1 data-testid="progress-cert-name" class="font-semibold text-2xl text-slate-100">
            {{ certName }}
          </h1>
          <p class="text-slate-400 text-sm">{{ certProvider }}</p>
        </template>
      </header>

      <div class="mb-6">
        <CertTabs :enrollments="switcher" :active-enrollment-id="enrollmentId" />
      </div>

      <TrajectoryCallout :weeks-to-ready="weeksToReady" class="mb-6" />

      <div class="mb-4 grid grid-cols-2 gap-3 rounded-md bg-black/25 p-4">
        <div>
          <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">Sessions</div>
          <div class="font-semibold text-2xl text-slate-100">{{ sessionCount }}</div>
        </div>
        <div v-if="questionsAnswered > 0">
          <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">Questions</div>
          <div class="font-semibold text-2xl text-slate-100">{{ questionsAnswered }}</div>
        </div>
      </div>

      <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadinessTrend :points="trend.points" :has-data="trend.hasData" />
        <AccuracyBars :series="accuracySeries" />
      </div>

      <CardPanel label="Domain Breakdown" class="mb-4">
        <div
          v-for="row in domainScores"
          :key="row.domain"
          class="border-readion-background-surface border-b last:border-b-0"
        >
          <ProgressDomainRow
            :domain="row.domain"
            :score="row.score"
            :status="row.status"
            :has-data="row.hasData"
            :delta="row.delta"
            :enrollment-id="enrollmentId"
          />
        </div>
      </CardPanel>

      <ProgressSessionHistoryTable :rows="historyRows" />
    </template>
  </section>
</template>
