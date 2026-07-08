<script setup lang="ts">
import CardPanel from '~/components/CardPanel.vue'
import DeltaBadge from '~/components/DeltaBadge.vue'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const props = defineProps<{ sessions: RecentSessionEntry[]; readinessDelta?: number | null }>()

const whenLabel = (session: RecentSessionEntry) =>
  new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const accuracyPercent = (accuracy: number) => `${Math.round(accuracy * 100)}%`

const deltaFor = (index: number): number | null =>
  index === 0 ? (props.readinessDelta ?? null) : null
</script>

<template>
  <CardPanel data-testid="recent-sessions-panel" label="Recent Sessions">
    <template v-if="props.sessions.length > 0">
      <div
        v-for="(session, index) in props.sessions"
        :key="session.id"
        data-testid="recent-session-row"
        class="mb-2 flex items-center justify-between gap-3 text-xs last:mb-0"
      >
        <div class="min-w-0">
          <div class="font-medium">{{ whenLabel(session) }}</div>
          <div class="opacity-60">{{ session.label }}</div>
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
          <span v-if="session.accuracy !== null">{{ accuracyPercent(session.accuracy) }}</span>
          <DeltaBadge v-if="deltaFor(index) !== null" :value="deltaFor(index) as number" />
        </div>
      </div>
    </template>
    <div v-else class="text-xs opacity-50">No sessions yet</div>
  </CardPanel>
</template>
