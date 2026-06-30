<script setup lang="ts">
import CardPanel from '~/components/CardPanel.vue'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const props = defineProps<{ sessions: RecentSessionEntry[] }>()

const rowLabel = (session: RecentSessionEntry) => `${session.date.slice(0, 10)} · ${session.label}`

const accuracyPercent = (accuracy: number) => `${Math.round(accuracy * 100)}%`
</script>

<template>
  <CardPanel data-testid="recent-sessions-panel" label="Recent Sessions">
    <template v-if="props.sessions.length > 0">
      <div
        v-for="session in props.sessions"
        :key="session.id"
        data-testid="recent-session-row"
        class="mb-1 flex justify-between text-xs"
      >
        <span>{{ rowLabel(session) }}</span>
        <span v-if="session.accuracy !== null">{{ accuracyPercent(session.accuracy) }}</span>
      </div>
    </template>
    <div v-else class="text-xs opacity-50">No sessions yet</div>
  </CardPanel>
</template>
