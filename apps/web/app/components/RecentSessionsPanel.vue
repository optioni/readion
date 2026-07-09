<script setup lang="ts">
import CardPanel from '~/components/CardPanel.vue'
import DeltaBadge from '~/components/DeltaBadge.vue'
import { friendlyDate } from '~/composables/friendlyDate'
import { statusColorForScore, statusTextColorClass } from '~/composables/statusColor'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const props = defineProps<{ sessions: RecentSessionEntry[] }>()

const whenLabel = (session: RecentSessionEntry) => friendlyDate(session.date)

const accuracyPercent = (accuracy: number) => `${Math.round(accuracy * 100)}%`

const accuracyColorClass = (accuracy: number) =>
  statusTextColorClass(statusColorForScore(Math.round(accuracy * 100)))

const durationLabel = (session: RecentSessionEntry): string | null => {
  if (session.durationMinutes === null) {
    return null
  }
  const suffix = session.kind === 'mock' ? ' · Mock' : ''
  return `${session.durationMinutes}m${suffix}`
}
</script>

<template>
  <CardPanel data-testid="recent-sessions-panel" label="Recent Sessions">
    <template v-if="props.sessions.length > 0">
      <template v-for="(session, index) in props.sessions" :key="session.id">
        <div
          data-testid="recent-session-row"
          class="flex items-center justify-between gap-3 py-2 text-xs first:pt-0 last:pb-0"
        >
          <div class="min-w-0">
            <div class="font-medium">{{ whenLabel(session) }}</div>
            <div
              v-if="durationLabel(session)"
              data-testid="recent-session-duration"
              class="opacity-60"
            >
              {{ durationLabel(session) }}
            </div>
          </div>
          <div class="flex flex-shrink-0 items-center gap-2">
            <span
              v-if="session.accuracy !== null"
              data-testid="recent-session-accuracy"
              class="font-medium"
              :class="accuracyColorClass(session.accuracy)"
            >
              {{ accuracyPercent(session.accuracy) }}
            </span>
            <DeltaBadge v-if="session.delta != null" :value="session.delta" />
          </div>
        </div>
        <div
          v-if="index < props.sessions.length - 1"
          data-testid="recent-session-divider"
          class="border-readion-background-surface border-b"
        />
      </template>
    </template>
    <div v-else class="text-xs opacity-50">No sessions yet</div>
  </CardPanel>
</template>
