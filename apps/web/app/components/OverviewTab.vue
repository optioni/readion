<script setup lang="ts">
import { computed } from 'vue'
import CardPanel from '~/components/CardPanel.vue'
import DomainScoreBar from '~/components/DomainScoreBar.vue'
import ProgressStatCard from '~/components/ProgressStatCard.vue'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import { formatCertStatRow } from '~/composables/certStatRow'
import { joinDomainScores } from '~/composables/domainScores'
import { selectSuggestedNextFocus } from '~/composables/suggestedNextFocus'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import { useCardReadiness } from '~/composables/useCardReadiness'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'
import { useOverviewSessions } from '~/composables/useOverviewSessions'
import type { CertificationDomainDto } from '~~/src/api/model'

const props = defineProps<{
  enrollmentId: string
  certificationId: string | null
  domains: CertificationDomainDto[]
}>()

const { readiness } = useCardReadiness(props.enrollmentId)
const { weakAreas } = useCertWeakAreas(props.enrollmentId)
const { sessions, totalSessions, nextFocusDomain, questionsAnswered, accuracy } =
  useOverviewSessions(computed(() => props.certificationId))
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

const domainRows = computed(() => joinDomainScores(props.domains, weakAreas.value))

const nextFocus = computed(() => selectSuggestedNextFocus(nextFocusDomain.value, weakAreas.value))
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
      <div>
        <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">Sessions</div>
        <div class="font-semibold text-2xl text-slate-100">{{ statRow.totalSessions }}</div>
      </div>
      <div>
        <div class="mb-1 text-[11px] uppercase tracking-wider opacity-70">Due Reviews</div>
        <div class="font-semibold text-2xl text-slate-100">{{ statRow.dueCount }}</div>
      </div>
      <ProgressStatCard
        data-testid="cert-detail-questions-stat"
        label="Questions"
        :value="String(statRow.questionsAnswered)"
        :unit="statRow.accuracyLabel ?? undefined"
        :unit-class="statRow.accuracyColorClass ?? undefined"
      />
    </div>

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
        />
      </div>
    </CardPanel>

    <CardPanel data-testid="suggested-next-focus" label="Suggested Next Focus">
      <div v-if="nextFocus.domain" class="text-sm text-slate-200">{{ nextFocus.domain }}</div>
      <div v-else class="text-xs opacity-50">No suggestion yet</div>
    </CardPanel>

    <RecentSessionsPanel :sessions="sessions" />
  </div>
</template>
