<script setup lang="ts">
import DeltaBadge from '~/components/DeltaBadge.vue'
import { friendlyDate } from '~/composables/friendlyDate'
import type { RecentSessionEntry } from '~/composables/useCardRecentSessions'

const props = defineProps<{ sessions: RecentSessionEntry[]; readinessDelta?: number | null }>()

const durationLabel = (durationMinutes: number | null) =>
  durationMinutes === null ? null : `${durationMinutes}m`

const deltaFor = (index: number): number | null =>
  index === 0 ? (props.readinessDelta ?? null) : null
</script>

<template>
  <div data-testid="recent-sessions-panel">
    <div class="mb-2 text-[10px] uppercase tracking-wider opacity-70">Recent sessions</div>
    <div v-if="props.sessions.length > 0" class="flex">
      <div
        v-for="(session, index) in props.sessions"
        :key="session.id"
        data-testid="recent-session-column"
        class="flex-1 px-3 text-[11px] first:pl-0 last:pr-0"
        :class="{ 'border-readion-background-surface border-l': index > 0 }"
      >
        <div class="mb-0.5 font-medium">{{ friendlyDate(session.date) }}</div>
        <div v-if="durationLabel(session.durationMinutes)" class="opacity-60">
          {{ durationLabel(session.durationMinutes) }}
        </div>
        <DeltaBadge
          v-if="deltaFor(index) !== null"
          class="mt-1"
          :value="deltaFor(index) as number"
        />
      </div>
    </div>
    <div v-else class="text-xs opacity-50">No sessions yet</div>
  </div>
</template>
