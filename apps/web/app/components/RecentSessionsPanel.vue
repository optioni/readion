<script setup lang="ts">
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const props = defineProps<{ sessions: RecentSessionEntry[] }>()

const rowLabel = (session: RecentSessionEntry) =>
  session.accuracy === null ? `${session.date.slice(0, 10)} · ${session.label}` : session.label

const accuracyPercent = (accuracy: number) => `${Math.round(accuracy * 100)}%`
</script>

<template>
  <div data-testid="recent-sessions-panel" class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Recent Sessions</div>
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
  </div>
</template>
