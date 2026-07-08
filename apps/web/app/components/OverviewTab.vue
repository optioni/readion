<script setup lang="ts">
import { computed } from 'vue'
import CardPanel from '~/components/CardPanel.vue'
import DomainScoreBar from '~/components/DomainScoreBar.vue'
import ProgressStatCard from '~/components/ProgressStatCard.vue'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import { formatCertStatRow } from '~/composables/certStatRow'
import { buildFocusRationale } from '~/composables/focusRationale'
import { daysSince, findLastStudiedAt } from '~/composables/lastStudiedAt'
import { selectSuggestedNextFocus } from '~/composables/suggestedNextFocus'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import { useCardReadiness } from '~/composables/useCardReadiness'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { useDomainScores } from '~/composables/useDomainScores'
import { useOverviewSessions } from '~/composables/useOverviewSessions'
import type { CertificationDomainDto } from '~~/src/api/model'

const props = defineProps<{
  enrollmentId: string
  certificationId: string | null
  domains: CertificationDomainDto[]
}>()

const { readiness } = useCardReadiness(props.enrollmentId)
const { weakAreas } = useCertWeakAreas(props.enrollmentId)
const {
  sessions,
  totalSessions,
  nextFocusDomain,
  questionsAnswered,
  accuracy,
  latestSummary,
  sessionFocusAreas,
} = useOverviewSessions(computed(() => props.certificationId))
const { dueCount } = useCardDueReviews(props.enrollmentId)

const statRow = computed(() =>
  formatCertStatRow({
    readiness: readiness.value,
    totalSessions: totalSessions.value,
    dueCount: dueCount.value,
    questionsAnswered: questionsAnswered.value,
    accuracy: accuracy.value,
  }),
)

const domainRows = computed(() =>
  useDomainScores(props.domains, weakAreas.value, latestSummary.value),
)

const nextFocus = computed(() => selectSuggestedNextFocus(nextFocusDomain.value, weakAreas.value))

const focusRationale = computed(() => {
  const domain = nextFocus.value.domain
  if (!domain) {
    return null
  }
  const lastStudiedAt = findLastStudiedAt(sessionFocusAreas.value, domain)
  const lastStudiedDaysAgo = lastStudiedAt ? daysSince(lastStudiedAt, new Date()) : null
  return buildFocusRationale(nextFocus.value.score, lastStudiedDaysAgo)
})
</script>

<template>
  <div class="space-y-4">
    <div
      data-testid="cert-detail-stat-row"
      class="grid grid-cols-4 gap-3 rounded-md bg-black/25 p-4"
    >
      <div>
        <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">Readiness</div>
        <div class="font-semibold text-2xl text-slate-100">{{ statRow.readinessLabel }}</div>
        <div
          v-if="statRow.trajectoryLabel"
          data-testid="stat-trajectory"
          class="mt-1 text-slate-400 text-xs"
        >
          {{ statRow.trajectoryLabel }}
        </div>
      </div>
      <ProgressStatCard label="Sessions" :value="String(statRow.totalSessions)" />
      <ProgressStatCard
        data-testid="cert-detail-questions-stat"
        label="Questions"
        :value="String(statRow.questionsAnswered)"
      />
      <ProgressStatCard
        data-testid="cert-detail-accuracy-stat"
        label="Avg accuracy"
        :value="statRow.accuracyLabel ?? '—'"
        :value-class="statRow.accuracyColorClass ?? undefined"
      />
    </div>

    <div class="grid gap-4 md:grid-cols-[2fr_1fr]">
      <CardPanel label="Domain Breakdown">
        <div
          v-for="row in domainRows"
          :key="row.domain"
          data-testid="domain-score-row"
          class="mb-2"
        >
          <DomainScoreBar
            :domain="row.domain"
            :score="row.score"
            :status="row.status"
            :has-data="row.hasData"
            :delta="row.delta"
          />
        </div>
      </CardPanel>

      <div
        data-testid="suggested-next-focus"
        class="rounded-xl border p-4"
        :class="
          nextFocus.domain
            ? 'border-readion-primary/20 bg-readion-primary/5'
            : 'border-readion-background-surface bg-black/25'
        "
      >
        <div class="mb-1.5 text-[10px] text-readion-primary uppercase tracking-wider">
          Suggested next
        </div>
        <div v-if="nextFocus.domain" data-testid="weakest-domain-panel">
          <div class="mb-1 font-medium text-sm text-slate-100">{{ nextFocus.domain }}</div>
          <div v-if="focusRationale" class="text-slate-400 text-xs leading-relaxed">
            {{ focusRationale }}
          </div>
        </div>
        <div v-else data-testid="weakest-domain-panel" class="text-xs opacity-50">
          No suggestion yet
        </div>
      </div>
    </div>

    <RecentSessionsPanel :sessions="sessions" />
  </div>
</template>
