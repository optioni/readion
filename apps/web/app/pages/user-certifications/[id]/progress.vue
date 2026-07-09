<script setup lang="ts">
import { computed } from 'vue'
import CertTabs from '~/components/CertTabs.vue'
import ProgressDomainRow from '~/components/ProgressDomainRow.vue'
import ProgressSessionHistoryTable from '~/components/ProgressSessionHistoryTable.vue'
import ProgressStatCard from '~/components/ProgressStatCard.vue'
import ReadinessAccuracyCard from '~/components/ReadinessAccuracyCard.vue'
import TrajectoryCallout from '~/components/TrajectoryCallout.vue'
import { pluralizeUnit } from '~/composables/paceFormatter'
import { useActivityStats } from '~/composables/useActivityStats'
import { useProgressData } from '~/composables/useProgressData'
import { useTrack } from '~/composables/useTrack'

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

useTrack().track('progress_viewed', { enrollmentId: enrollmentId.value })

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
const streakUnit = computed(() => pluralizeUnit(activityStats.value.currentStreakDays, 'day'))
const showProjection = computed(() => weeksToReady.value !== null)
</script>

<template>
  <section data-testid="progress-page" class="mx-auto max-w-[1100px]">
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

      <div class="mb-6">
        <div class="mb-2.5 text-[11px] uppercase tracking-wider opacity-70">This month</div>
        <div class="flex gap-3">
          <ProgressStatCard label="Sessions" :value="String(activityStats.sessionCount)" />
          <ProgressStatCard
            label="Questions answered"
            :value="String(activityStats.questionsAnswered)"
          />
          <ProgressStatCard label="Study time" :value="activityStats.studyTimeLabel" />
          <ProgressStatCard
            label="Current streak"
            :value="String(activityStats.currentStreakDays)"
            :unit="streakUnit"
          />
        </div>
      </div>

      <div class="mb-6">
        <div class="mb-2.5 flex items-center justify-between">
          <div class="text-[11px] uppercase tracking-wider opacity-70">Readiness over time</div>
          <span class="text-[11px] opacity-50">{{ trend.points.length }} sessions</span>
        </div>
        <ReadinessAccuracyCard
          :points="trend.points"
          :has-data="trend.hasData"
          :show-projection="showProjection"
          :series="accuracySeries"
          class="mb-2.5"
        />
        <TrajectoryCallout :weeks-to-ready="weeksToReady" :pace-rate="paceRate" />
      </div>

      <div class="mb-6">
        <div class="mb-2.5 text-[11px] uppercase tracking-wider opacity-70">Domain scores</div>
        <div class="rounded-xl border border-readion-background-surface bg-readion-background-surface/40 px-4 py-1">
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
        </div>
      </div>

      <div>
        <div class="mb-2.5 flex items-center justify-between">
          <div class="text-[11px] uppercase tracking-wider opacity-70">Session history</div>
          <span class="text-[11px] opacity-50">{{ historyRows.length }} sessions total</span>
        </div>
        <ProgressSessionHistoryTable :rows="historyRows" />
      </div>
    </template>
  </section>
</template>
