<script setup lang="ts">
import { computed } from 'vue'
import CardReadiness from '~/components/CardReadiness.vue'
import CardSessionColumns from '~/components/CardSessionColumns.vue'
import QuickStartButtons from '~/components/QuickStartButtons.vue'
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

const {
  startSession,
  startMockExam,
  isStartingSession,
  isStartingMockExam,
  sessionError,
  mockExamError,
} = useQuickStartActions(props.card.enrollmentId)

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
    class="mb-4 rounded-xl p-6"
    :class="{ 'border border-readion-background-surface bg-readion-background-surface': !isHero }"
    :style="cardStyle"
  >
    <div class="mb-4 flex items-start justify-between gap-5">
      <NuxtLink
        data-testid="cert-title"
        :to="`/user-certifications/${props.card.enrollmentId}`"
        class="block min-w-0 transition-opacity hover:opacity-90"
      >
        <p
          v-if="isHero"
          class="mb-1 font-medium text-[10px] uppercase tracking-widest opacity-60"
        >
          NEEDS ATTENTION
        </p>
        <h2 class="font-semibold text-base leading-snug">{{ props.card.name }}</h2>
        <div class="mt-1 flex items-center gap-2">
          <p class="text-[11px] opacity-70">{{ props.card.provider }}</p>
          <span
            v-if="props.card.code"
            data-testid="cert-code-pill"
            class="rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide"
            :class="isHero ? 'bg-white/10 opacity-35' : 'bg-readion-background-elevated opacity-70'"
          >
            {{ props.card.code }}
          </span>
        </div>
      </NuxtLink>
      <CardReadiness
        :display="readinessDisplay"
        :hero="isHero"
        class="flex-shrink-0 text-right"
      />
    </div>
    <div
      data-testid="card-section-divider"
      class="mb-4 h-px"
      :class="isHero ? 'bg-white/10' : 'bg-readion-background-surface'"
    />
    <WeakAreasPanel class="mb-4" :weak-areas="weakAreas" :hero="isHero" />
    <div
      data-testid="card-section-divider"
      class="mb-4 h-px"
      :class="isHero ? 'bg-white/10' : 'bg-readion-background-surface'"
    />
    <CardSessionColumns class="mb-4" :sessions="sessions" :readiness-delta="readinessDelta" />
    <div
      data-testid="card-section-divider"
      class="mb-4 h-px"
      :class="isHero ? 'bg-white/10' : 'bg-readion-background-surface'"
    />
    <div class="flex items-center justify-between gap-3">
      <ReviewQuickStart
        v-if="dueCount > 0"
        :enrollment-id="props.card.enrollmentId"
        :due-count="dueCount"
        :hero="isHero"
      />
      <span v-else />
      <QuickStartButtons
        :variant="variant"
        :is-starting-session="isStartingSession"
        :is-starting-mock-exam="isStartingMockExam"
        :session-error="sessionError"
        :mock-exam-error="mockExamError"
        @start-session="startSession"
        @mock-exam="startMockExam"
      />
    </div>
  </article>
</template>
