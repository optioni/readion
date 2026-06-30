<script setup lang="ts">
import { computed } from 'vue'
import AccuracyBars from '~/components/AccuracyBars.vue'
import CardPanel from '~/components/CardPanel.vue'
import CertTabs from '~/components/CertTabs.vue'
import ProgressDomainRow from '~/components/ProgressDomainRow.vue'
import ProgressSessionHistoryTable from '~/components/ProgressSessionHistoryTable.vue'
import ProgressStatCard from '~/components/ProgressStatCard.vue'
import ReadinessTrend from '~/components/ReadinessTrend.vue'
import TrajectoryCallout from '~/components/TrajectoryCallout.vue'
import { useActivityStats } from '~/composables/useActivityStats'
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
  paceRate,
  historyRows,
  sessions,
  summariesMap,
  switcher,
  isLoading,
} = useProgressData(enrollmentId.value)

const activityStats = computed(() => useActivityStats(sessions.value, summariesMap.value))
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

      <TrajectoryCallout :weeks-to-ready="weeksToReady" :pace-rate="paceRate" class="mb-6" />

      <div class="mb-4 grid grid-cols-2 gap-3 rounded-md bg-black/25 p-4 sm:grid-cols-4">
        <ProgressStatCard label="Sessions" :value="String(activityStats.sessionCount)" />
        <ProgressStatCard
          label="Questions answered"
          :value="String(activityStats.questionsAnswered)"
        />
        <ProgressStatCard label="Study time" :value="activityStats.studyTimeLabel" />
        <ProgressStatCard
          label="Current streak"
          :value="String(activityStats.currentStreakDays)"
          unit="days"
        />
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
