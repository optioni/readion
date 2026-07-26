<script setup lang="ts">
import { computed } from 'vue'
import CertTabs from '~/components/CertTabs.vue'
import ProgressDomainRow from '~/components/ProgressDomainRow.vue'
import ProgressSessionHistoryTable from '~/components/ProgressSessionHistoryTable.vue'
import ProgressStatCard from '~/components/ProgressStatCard.vue'
import ReadinessAccuracyCard from '~/components/ReadinessAccuracyCard.vue'
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
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
  summaryState,
  trendState,
  domainState,
  historyState,
  retrySummary,
  retryTrend,
  retryDomains,
  retryHistory,
} = useProgressData(enrollmentId.value)

const activityStats = computed(() => useActivityStats(sessions.value, summariesMap.value))
const streakUnit = computed(() => pluralizeUnit(activityStats.value.currentStreakDays, 'day'))
const showProjection = computed(() => weeksToReady.value !== null)

const activeDomainRows = computed(() => domainScores.value.filter((row) => !row.mastered))
const masteredDomainRows = computed(() => domainScores.value.filter((row) => row.mastered))
</script>

<template>
  <section data-testid="progress-page" class="mx-auto w-full max-w-[1100px] min-w-0">
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

      <div
        data-testid="progress-summary-region"
        class="mb-6 min-w-0"
        :aria-busy="summaryState.loading || summaryState.refreshing ? 'true' : undefined"
      >
        <div class="mb-2.5 text-[11px] uppercase tracking-wider opacity-70">This month</div>
        <ReadionAsyncRegion
          :loading="summaryState.loading"
          :error="summaryState.error"
          :refreshing="summaryState.refreshing"
          loading-label="Loading activity summary…"
          refresh-label="Refreshing activity summary…"
          aria-label="Activity summary"
          @retry="retrySummary"
        >
          <template #loading>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
              <div
                v-for="index in 4"
                :key="index"
                class="h-20 animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
              />
            </div>
          </template>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </ReadionAsyncRegion>
      </div>

      <div
        data-testid="progress-trend-region"
        class="mb-6 min-w-0"
        :aria-busy="trendState.loading || trendState.refreshing ? 'true' : undefined"
      >
        <div class="mb-2.5 flex items-center justify-between">
          <div class="text-[11px] uppercase tracking-wider opacity-70">Readiness over time</div>
          <span v-if="!trendState.loading && !trendState.error" class="text-[11px] opacity-50">
            {{ trend.points.length }} sessions
          </span>
        </div>
        <ReadionAsyncRegion
          :loading="trendState.loading"
          :error="trendState.error"
          :refreshing="trendState.refreshing"
          loading-label="Loading readiness history…"
          refresh-label="Refreshing readiness history…"
          aria-label="Readiness history"
          @retry="retryTrend"
        >
          <template #loading>
            <div
              class="h-52 animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
              aria-hidden="true"
            />
          </template>
          <ReadinessAccuracyCard
            :points="trend.points"
            :has-data="trend.hasData"
            :show-projection="showProjection"
            :series="accuracySeries"
            class="mb-2.5"
          />
          <TrajectoryCallout :weeks-to-ready="weeksToReady" :pace-rate="paceRate" />
        </ReadionAsyncRegion>
      </div>

      <div
        data-testid="progress-domains-region"
        class="mb-6 min-w-0"
        :aria-busy="domainState.loading || domainState.refreshing ? 'true' : undefined"
      >
        <div class="mb-2.5 text-[11px] uppercase tracking-wider opacity-70">Domain scores</div>
        <ReadionAsyncRegion
          :loading="domainState.loading"
          :empty="domainScores.length === 0"
          :error="domainState.error"
          :refreshing="domainState.refreshing"
          loading-label="Loading domain scores…"
          empty-label="No domain scores yet."
          refresh-label="Refreshing domain scores…"
          aria-label="Domain scores"
          @retry="retryDomains"
        >
          <template #loading>
            <div
              class="h-40 animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
              aria-hidden="true"
            />
          </template>
          <div
            class="rounded-xl border border-readion-background-surface bg-readion-background-surface/40 px-4 py-1"
          >
            <div
              v-for="(row, index) in activeDomainRows"
              :key="row.domain"
              class="border-readion-background-surface border-b"
              :class="{ 'border-b-0': index === activeDomainRows.length - 1 && masteredDomainRows.length === 0 }"
            >
              <ProgressDomainRow
                :domain="row.domain"
                :score="row.score"
                :status="row.status"
                :has-data="row.hasData"
                :delta="row.delta"
                :enrollment-id="enrollmentId"
                :mastered="row.mastered"
              />
            </div>

            <template v-if="masteredDomainRows.length > 0">
              <div class="flex items-center gap-2 py-2">
                <div class="h-px flex-1 bg-readion-background-surface" />
                <span class="text-[10px] text-slate-500 uppercase tracking-wider">Mastered</span>
                <div class="h-px flex-1 bg-readion-background-surface" />
              </div>
              <div
                v-for="(row, index) in masteredDomainRows"
                :key="row.domain"
                class="border-readion-background-surface border-b"
                :class="{ 'border-b-0': index === masteredDomainRows.length - 1 }"
              >
                <ProgressDomainRow
                  :domain="row.domain"
                  :score="row.score"
                  :status="row.status"
                  :has-data="row.hasData"
                  :delta="row.delta"
                  :enrollment-id="enrollmentId"
                  :mastered="row.mastered"
                />
              </div>
            </template>
          </div>
        </ReadionAsyncRegion>
      </div>

      <div
        data-testid="progress-history-region"
        class="min-w-0"
        :aria-busy="historyState.loading || historyState.refreshing ? 'true' : undefined"
      >
        <div class="mb-2.5 flex items-center justify-between">
          <div class="text-[11px] uppercase tracking-wider opacity-70">Session history</div>
          <span v-if="!historyState.loading && !historyState.error" class="text-[11px] opacity-50">
            {{ historyRows.length }} sessions total
          </span>
        </div>
        <ReadionAsyncRegion
          :loading="historyState.loading"
          :empty="historyRows.length === 0"
          :error="historyState.error"
          :refreshing="historyState.refreshing"
          loading-label="Loading session history…"
          empty-label="No session history yet."
          refresh-label="Refreshing session history…"
          aria-label="Session history"
          @retry="retryHistory"
        >
          <template #loading>
            <div
              class="h-40 animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
              aria-hidden="true"
            />
          </template>
          <div class="max-w-full overflow-x-auto p-0.5">
            <ProgressSessionHistoryTable :rows="historyRows" />
          </div>
        </ReadionAsyncRegion>
      </div>
    </template>
  </section>
</template>
