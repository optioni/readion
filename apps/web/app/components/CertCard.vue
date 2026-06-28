<script setup lang="ts">
import { computed } from 'vue'
import CardReadiness from '~/components/CardReadiness.vue'
import QuickStartButtons from '~/components/QuickStartButtons.vue'
import RecentSessionsPanel from '~/components/RecentSessionsPanel.vue'
import ReviewQuickStart from '~/components/ReviewQuickStart.vue'
import WeakAreasPanel from '~/components/WeakAreasPanel.vue'
import { formatReadiness } from '~/composables/readinessFormat'
import { useCardDueReviews } from '~/composables/useCardDueReviews'
import { useCardReadiness } from '~/composables/useCardReadiness'
import { useCardRecentSessions } from '~/composables/useCardRecentSessions'
import { useCardWeakAreas } from '~/composables/useCardWeakAreas'
import type { EnrollmentCard } from '~/composables/useEnrollments'
import { useQuickStartActions } from '~/composables/useQuickStartActions'

const props = defineProps<{ card: EnrollmentCard; variant: 'hero' | 'standard' }>()

const { startSession, startMockExam, isStartingSession, isStartingMockExam } = useQuickStartActions(
  props.card.enrollmentId,
)

const { readiness } = useCardReadiness(props.card.enrollmentId)
const { weakAreas } = useCardWeakAreas(props.card.enrollmentId)
const { sessions, readinessDelta } = useCardRecentSessions(
  props.card.enrollmentId,
  props.card.certificationId,
)
const { dueCount } = useCardDueReviews(props.card.enrollmentId)

const isHero = computed(() => props.variant === 'hero')
const readinessDisplay = computed(() => formatReadiness(readiness.value, readinessDelta.value))

const HERO_GRADIENT = 'linear-gradient(135deg, var(--readion-primary), #4f46e5)'
const cardStyle = computed(() =>
  isHero.value
    ? { background: HERO_GRADIENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', color: '#fff' }
    : {},
)
</script>

<template>
  <article
    data-testid="cert-card"
    :data-variant="variant"
    class="mb-4 rounded-lg p-6"
    :class="{ 'bg-readion-background-surface': !isHero }"
    :style="cardStyle"
  >
    <div class="mb-4 flex items-start justify-between">
      <div>
        <NuxtLink
          data-testid="cert-title"
          :to="`/user-certifications/${props.card.enrollmentId}`"
          class="mb-1 block text-[11px] uppercase tracking-wider opacity-80 transition-opacity hover:opacity-100"
        >
          {{ props.card.name }} · {{ props.card.provider }}
        </NuxtLink>
        <CardReadiness :display="readinessDisplay" />
      </div>
      <QuickStartButtons
        :variant="variant"
        :is-starting-session="isStartingSession"
        :is-starting-mock-exam="isStartingMockExam"
        @start-session="startSession"
        @mock-exam="startMockExam"
      />
    </div>
    <div class="grid grid-cols-2 gap-3">
      <WeakAreasPanel :weak-areas="weakAreas" />
      <RecentSessionsPanel :sessions="sessions" />
    </div>
    <ReviewQuickStart
      v-if="dueCount > 0"
      :enrollment-id="props.card.enrollmentId"
      :due-count="dueCount"
    />
  </article>
</template>
